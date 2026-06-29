import uuid

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        FRONT_DESK = "FRONT_DESK", "Front Desk"
        DIRECTOR = "DIRECTOR", "Director"
        OPS_MANAGER = "OPS_MANAGER", "Operations Manager"
        TECHNICIAN = "TECHNICIAN", "Technician"
        STOCK_KEEPER = "STOCK_KEEPER", "Stock Keeper"

    role = models.CharField(max_length=20, choices=Role.choices, blank=True)
    branch = models.ForeignKey(
        "branches.Branch",
        on_delete=models.RESTRICT,
        related_name="users",
        null=True,
        blank=True,
    )
    phone_number = models.CharField(max_length=20, blank=True)
    pin_hash = models.CharField(max_length=128, blank=True)

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.role})"


class Session(models.Model):
    """Tracks each active login. Refresh token is stored as a SHA-256 hash."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sessions",
    )
    # SHA-256 hex digest of the raw refresh token (64 chars). Never store the raw token.
    token_hash = models.CharField(max_length=64, db_index=True)
    user_agent = models.TextField(blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    device_name = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_activity = models.DateTimeField(auto_now=True)
    expires_at = models.DateTimeField()
    is_revoked = models.BooleanField(default=False, db_index=True)

    class Meta:
        ordering = ["-last_activity"]

    def __str__(self):
        status = "revoked" if self.is_revoked else "active"
        return f"{self.user.username} — {status} ({self.ip_address})"


class AuditLog(models.Model):
    class Severity(models.TextChoices):
        INFO = "info", "Info"
        WARNING = "warning", "Warning"
        CRITICAL = "critical", "Critical"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
    )
    action = models.CharField(max_length=100)
    resource_type = models.CharField(max_length=100, blank=True)
    resource_id = models.CharField(max_length=100, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    severity = models.CharField(
        max_length=10, choices=Severity.choices, default=Severity.INFO
    )
    metadata = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        user_str = self.user.username if self.user else "anonymous"
        return f"{user_str} — {self.action} ({self.severity})"
