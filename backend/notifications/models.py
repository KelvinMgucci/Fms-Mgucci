from django.db import models


class SMSLog(models.Model):
    class Status(models.TextChoices):
        SENT = "SENT", "Sent"
        FAILED = "FAILED", "Failed"

    recipient_phone = models.CharField(max_length=20)
    message_body = models.TextField()
    trigger_event = models.CharField(max_length=100)
    status = models.CharField(max_length=6, choices=Status.choices)
    gateway_response = models.TextField(blank=True)
    sent_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["-sent_at"])]

    def __str__(self):
        return f"{self.trigger_event} → {self.recipient_phone} ({self.status})"
