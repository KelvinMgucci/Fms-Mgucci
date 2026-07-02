from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from branches.models import Branch
from orders.models import Order
from users.models import AuditLog

from .models import InventoryItem

User = get_user_model()


def _make_user(role, branch=None, username=None):
    return User.objects.create_user(
        username=username or f"{role.lower()}1",
        password="pass12345",
        role=role,
        branch=branch,
    )


class InventoryItemTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.branch = Branch.objects.create(name="Main", location="Town")
        self.stock_keeper = _make_user(User.Role.STOCK_KEEPER, self.branch)
        self.director = _make_user(User.Role.DIRECTOR, self.branch)
        self.technician = _make_user(User.Role.TECHNICIAN, self.branch)

    def test_stock_keeper_can_add_item(self):
        self.client.force_authenticate(self.stock_keeper)
        resp = self.client.post(
            "/api/stock/items/",
            {"name": "Teak Plank", "unit": "boards", "current_quantity": "10", "minimum_threshold": "2"},
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(InventoryItem.objects.count(), 1)
        self.assertTrue(
            AuditLog.objects.filter(action="inventory_item_created").exists()
        )

    def test_other_roles_cannot_add_item(self):
        self.client.force_authenticate(self.technician)
        resp = self.client.post(
            "/api/stock/items/", {"name": "X", "unit": "kg"}
        )
        self.assertEqual(resp.status_code, 403)

    def test_updating_quantity_writes_audit_log(self):
        item = InventoryItem.objects.create(name="Screws", unit="kg", current_quantity=5, minimum_threshold=1)
        self.client.force_authenticate(self.stock_keeper)
        resp = self.client.patch(f"/api/stock/items/{item.id}/", {"current_quantity": "8"}, format="json")
        self.assertEqual(resp.status_code, 200)
        item.refresh_from_db()
        self.assertEqual(item.current_quantity, Decimal("8"))
        log = AuditLog.objects.filter(action="inventory_item_updated", resource_id=str(item.id)).first()
        self.assertIsNotNone(log)
        self.assertEqual(log.metadata["current_quantity"], {"from": "5.000", "to": "8"})

    def test_low_stock_flag(self):
        low = InventoryItem.objects.create(name="Glue", unit="l", current_quantity=1, minimum_threshold=5)
        self.assertTrue(low.is_low_stock)
        high = InventoryItem.objects.create(name="Nails", unit="kg", current_quantity=50, minimum_threshold=5)
        self.assertFalse(high.is_low_stock)


class IssuanceTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.branch = Branch.objects.create(name="Main", location="Town")
        self.stock_keeper = _make_user(User.Role.STOCK_KEEPER, self.branch)
        self.front_desk = _make_user(User.Role.FRONT_DESK, self.branch)
        self.item = InventoryItem.objects.create(
            name="Plywood", unit="sheets", current_quantity=10, minimum_threshold=2
        )
        self.order = Order.objects.create(
            reference_number="FMS-TEST-0001",
            branch=self.branch,
            created_by=self.front_desk,
            customer_name="Jane",
            customer_phone="0700000000",
            item_description="Cabinet",
        )

    def test_issue_deducts_stock_and_logs_audit(self):
        self.client.force_authenticate(self.stock_keeper)
        resp = self.client.post(
            "/api/stock/issuances/",
            {"order_id": self.order.id, "inventory_item_id": self.item.id, "quantity_issued": "4"},
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.item.refresh_from_db()
        self.assertEqual(self.item.current_quantity, Decimal("6"))
        self.assertTrue(AuditLog.objects.filter(action="material_issued").exists())

    def test_cannot_issue_more_than_available(self):
        self.client.force_authenticate(self.stock_keeper)
        resp = self.client.post(
            "/api/stock/issuances/",
            {"order_id": self.order.id, "inventory_item_id": self.item.id, "quantity_issued": "999"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.item.refresh_from_db()
        self.assertEqual(self.item.current_quantity, Decimal("10"))


class InventoryAuditLogViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.branch = Branch.objects.create(name="Main", location="Town")
        self.stock_keeper = _make_user(User.Role.STOCK_KEEPER, self.branch)
        self.technician = _make_user(User.Role.TECHNICIAN, self.branch)
        self.item = InventoryItem.objects.create(name="Foam", unit="kg", current_quantity=5)
        AuditLog.objects.create(
            user=self.stock_keeper, action="inventory_item_created",
            resource_type="InventoryItem", resource_id=str(self.item.id),
        )

    def test_stock_keeper_can_view_audit_log(self):
        self.client.force_authenticate(self.stock_keeper)
        resp = self.client.get("/api/stock/audit-log/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data["results"]), 1)

    def test_technician_forbidden_from_audit_log(self):
        self.client.force_authenticate(self.technician)
        resp = self.client.get("/api/stock/audit-log/")
        self.assertEqual(resp.status_code, 403)
