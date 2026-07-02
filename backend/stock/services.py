from users.models import AuditLog


def log_inventory_event(user, action, item, metadata=None):
    """Record an inventory audit trail entry against the shared AuditLog."""
    AuditLog.objects.create(
        user=user,
        action=action,
        resource_type="InventoryItem",
        resource_id=str(item.id),
        metadata=metadata or {},
    )
