from django.urls import path

from .views import (
    ChangePasswordView,
    LoginView,
    LogoutView,
    MeView,
    ProfileView,
    RefreshView,
    RevokeAllSessionsView,
    SessionListView,
)

urlpatterns = [
    path("login/",           LoginView.as_view(),          name="auth_login"),
    path("logout/",          LogoutView.as_view(),          name="auth_logout"),
    path("refresh/",         RefreshView.as_view(),         name="auth_refresh"),
    path("me/",              MeView.as_view(),              name="auth_me"),
    path("profile/",         ProfileView.as_view(),         name="auth_profile"),
    path("change-password/", ChangePasswordView.as_view(), name="auth_change_password"),
    path("sessions/",            SessionListView.as_view(),       name="session_list"),
    path("sessions/revoke-all/", RevokeAllSessionsView.as_view(), name="session_revoke_all"),
]
