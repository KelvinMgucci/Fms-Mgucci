from django.urls import path

from .views import OrderCollectView, OrderListCreateView

urlpatterns = [
    path("", OrderListCreateView.as_view(), name="order_list_create"),
    path("<int:pk>/collect/", OrderCollectView.as_view(), name="order_collect"),
]
