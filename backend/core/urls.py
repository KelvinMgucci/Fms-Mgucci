from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from django.views.decorators.http import require_http_methods


@require_http_methods(["GET"])
def health(request):
    return JsonResponse({"status": "ok", "service": "FMS API"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health, name="health"),

    path("api/auth/", include("users.urls")),

    path("api/orders/", include("orders.urls")),
    path("api/production/", include("production.urls")),
    path("api/stock/", include("stock.urls")),
    path("api/shop/", include("shop.urls")),
    path("api/notifications/", include("notifications.urls")),
    path("api/reports/", include("reports.urls")),
    path("api/branches/", include("branches.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
