from django.urls import path

from .views import CompleteStageView, MyQueueView

urlpatterns = [
    path("my-queue/", MyQueueView.as_view(), name="production_my_queue"),
    path("stages/<int:pk>/complete/", CompleteStageView.as_view(), name="production_stage_complete"),
]
