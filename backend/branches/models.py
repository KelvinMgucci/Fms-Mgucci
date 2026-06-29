from django.db import models


class Branch(models.Model):
    name = models.CharField(max_length=100)
    location = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "branches"

    def __str__(self):
        return self.name
