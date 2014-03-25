from django.contrib import admin
from metrics_manager.models import IncomingData, MetricSummary, Channel

class MetricSummaryAdmin(admin.ModelAdmin):
    list_display = ["country_code", "channel", "metric", "total"]


class IncomingDataAdmin(admin.ModelAdmin):

    list_display = ["created_at", "source_timestamp", "channel", "channel_uid",
        "msisdn", "email", "name", "farmer", "budget_enough", "budget_think",
        "budget_should", "sex", "age", "country_code", "location", "download_mp3",
        "download_ringback"]
    
class ChannelAdmin(admin.ModelAdmin):
    pass

admin.site.register(MetricSummary, MetricSummaryAdmin)
admin.site.register(IncomingData, IncomingDataAdmin)
admin.site.register(Channel, ChannelAdmin)
