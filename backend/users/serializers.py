from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


class FMSTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["branch_id"] = user.branch_id
        token["username"] = user.username
        token["full_name"] = user.get_full_name()
        return token
