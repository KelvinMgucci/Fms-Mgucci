"""
CookieJWTAuthentication
-----------------------
Reads the access token from the `access_token` HttpOnly cookie instead of
the Authorization header.  On every authenticated request it also checks
Session.is_revoked so a stolen token can be killed immediately via logout.
"""

from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import TokenError


class CookieJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        raw_token = request.COOKIES.get("access_token")
        if raw_token is None:
            return None  # unauthenticated — let the view decide

        try:
            validated_token = self.get_validated_token(raw_token)
        except TokenError:
            # Expired or malformed token — treat as unauthenticated so
            # AllowAny views (login, refresh) still work.
            return None

        # Revocation check — one DB query per request, worth the safety guarantee
        session_id = validated_token.get("session_id")
        if session_id:
            from .models import Session  # local import avoids circular import

            try:
                session = Session.objects.get(id=session_id)
            except Session.DoesNotExist:
                # Stale cookie pointing at a deleted session (e.g. after a DB
                # flush). Treat as unauthenticated so AllowAny views (login)
                # still work and the client can obtain a fresh session.
                return None
            if session.is_revoked:
                raise AuthenticationFailed("Session has been revoked.")

        return self.get_user(validated_token), validated_token
