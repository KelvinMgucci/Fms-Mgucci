from datetime import date
from decimal import Decimal, InvalidOperation

from django.db import transaction
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Order, OrderImage


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _gen_reference():
    prefix = f"FMS-{date.today().strftime('%Y%m%d')}"
    count = Order.objects.filter(reference_number__startswith=prefix).count() + 1
    return f"{prefix}-{count:04d}"


def _order_payload(order, request=None):
    def img_url(img):
        if request:
            return request.build_absolute_uri(img.image_file.url)
        return img.image_file.url

    return {
        "id": order.id,
        "reference_number": order.reference_number,
        "status": order.status,
        "customer_name": order.customer_name,
        "customer_phone": order.customer_phone,
        "item_description": order.item_description,
        "quoted_price": str(order.quoted_price) if order.quoted_price is not None else None,
        "confirmed_price": str(order.confirmed_price) if order.confirmed_price is not None else None,
        "delivery_date": str(order.delivery_date) if order.delivery_date else None,
        "notes": order.notes,
        "branch_id": order.branch_id,
        "created_by_id": order.created_by_id,
        "created_at": order.created_at.isoformat(),
        "updated_at": order.updated_at.isoformat(),
        "images": [{"id": img.id, "url": img_url(img)} for img in order.images.all()],
    }


def _validate_order_data(request):
    """Validate POST data and return (errors, quoted_price, delivery_date)."""
    data = request.data
    errors: dict[str, list[str]] = {}

    for field in ("customer_name", "customer_phone", "item_description"):
        if not str(data.get(field, "")).strip():
            errors[field] = ["This field is required."]

    quoted_price: Decimal | None = None
    raw_price = str(data.get("quoted_price", "")).strip()
    if raw_price:
        try:
            quoted_price = Decimal(raw_price)
            if quoted_price < 0:
                errors["quoted_price"] = ["Price cannot be negative."]
        except InvalidOperation:
            errors["quoted_price"] = ["Enter a valid number."]

    delivery_date: date | None = None
    raw_date = str(data.get("delivery_date", "")).strip()
    if not raw_date:
        errors["delivery_date"] = ["This field is required."]
    else:
        try:
            delivery_date = date.fromisoformat(raw_date)
        except ValueError:
            errors["delivery_date"] = ["Enter a valid date (YYYY-MM-DD)."]

    if not request.user.branch_id:
        errors["non_field"] = ["Your account has no branch assigned."]

    return errors, quoted_price, delivery_date


# ---------------------------------------------------------------------------
# Views
# ---------------------------------------------------------------------------

class OrderListCreateView(APIView):
    """
    GET  /api/orders/          — list orders (scoped by role)
    POST /api/orders/          — create order (multipart/form-data)

    POST fields
    -----------
    customer_name      str   required
    customer_phone     str   required
    item_description   str   required
    quoted_price       num   optional
    delivery_date      date  required  YYYY-MM-DD
    notes              str   optional
    requires_approval  bool  optional  "true"/"false"  (default false)
    images             file  optional  repeatable

    Error shape
    -----------
    400  { "errors": { "<field>": ["<message>"] } }
    201  <order payload>
    """
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Order.objects.prefetch_related("images").order_by("-created_at")

        # Front desk can only see their own branch
        if request.user.role == "FRONT_DESK":
            qs = qs.filter(branch=request.user.branch)

        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)

        return Response([_order_payload(o, request) for o in qs])

    def post(self, request):
        errors, quoted_price, delivery_date = _validate_order_data(request)
        if errors:
            return Response({"errors": errors}, status=400)

        raw_approval = str(request.data.get("requires_approval", "false")).lower()
        status_val = (
            Order.Status.PRICE_REVIEW
            if raw_approval in ("true", "1", "yes")
            else Order.Status.OPS_QUEUE
        )

        with transaction.atomic():
            order = Order.objects.create(
                reference_number=_gen_reference(),
                branch=request.user.branch,
                created_by=request.user,
                customer_name=str(request.data["customer_name"]).strip(),
                customer_phone=str(request.data["customer_phone"]).strip(),
                item_description=str(request.data["item_description"]).strip(),
                quoted_price=quoted_price,
                delivery_date=delivery_date,
                notes=str(request.data.get("notes", "")).strip(),
                status=status_val,
            )
            for img_file in request.FILES.getlist("images"):
                OrderImage.objects.create(
                    order=order,
                    image_file=img_file,
                    uploaded_by=request.user,
                )

        order.refresh_from_db()
        return Response(_order_payload(order, request), status=201)


class OrderCollectView(APIView):
    """POST /api/orders/<pk>/collect/ — mark WORKSHOP_COMPLETE → DISPATCHED."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            order = Order.objects.get(pk=pk, status=Order.Status.WORKSHOP_COMPLETE)
        except Order.DoesNotExist:
            return Response({"detail": "Order not found or not ready for collection."}, status=404)

        order.status = Order.Status.DISPATCHED
        order.save(update_fields=["status", "updated_at"])
        return Response(_order_payload(order, request))
