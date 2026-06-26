from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path("admin/", admin.site.urls),
    # JWT auth endpoints
    path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    # App routers (wired in as each app is built out)
    path("api/users/", include("users.urls")),
    path("api/orders/", include("orders.urls")),
    path("api/production/", include("production.urls")),
    path("api/stock/", include("stock.urls")),
    path("api/shop/", include("shop.urls")),
    path("api/notifications/", include("notifications.urls")),
    path("api/reports/", include("reports.urls")),
    path("api/branches/", include("branches.urls")),
]
