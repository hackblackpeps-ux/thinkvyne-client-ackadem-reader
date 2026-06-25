from rest_framework import serializers
from .models import Book, UserReadingProgress, Series, InAppNotification


class SeriesSerializer(serializers.ModelSerializer):
    cover_image_url = serializers.SerializerMethodField()

    class Meta:
        model = Series
        fields = ['id', 'title', 'description', 'cover_image_url', 'created_at']

    def get_cover_image_url(self, obj):
        request = self.context.get('request')
        if obj.cover_image and request:
            return request.build_absolute_uri(obj.cover_image.url)
        return None


class BookSerializer(serializers.ModelSerializer):
    magazine_id = serializers.CharField(source='id', read_only=True)
    series_id = serializers.PrimaryKeyRelatedField(source='series', read_only=True)
    pdf_url = serializers.SerializerMethodField()

    class Meta:
        model = Book
        fields = ['magazine_id', 'series_id', 'title', 'pdf_url', 'total_pages', 'scripts', 'publish_date', 'created_at']

    def get_pdf_url(self, obj):
        request = self.context.get('request')
        if obj.pdf_file and request:
            return request.build_absolute_uri(obj.pdf_file.url)
        return None


class BookListSerializer(serializers.ModelSerializer):
    magazine_id = serializers.CharField(source='id', read_only=True)
    series_id = serializers.PrimaryKeyRelatedField(source='series', read_only=True)

    class Meta:
        model = Book
        fields = ['magazine_id', 'series_id', 'title', 'total_pages', 'publish_date', 'created_at', 'updated_at']


class UserReadingProgressSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserReadingProgress
        fields = ['page_index']


class InAppNotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = InAppNotification
        fields = ['id', 'series', 'book', 'message', 'created_at']
