from django.contrib import admin
from metrics_manager.models import IncomingData, MetricSummary, Channel

class MetricSummaryAdmin(admin.ModelAdmin):
    list_display = ["country_code", "channel", "metric", "total"]


class IncomingDataAdmin(admin.ModelAdmin):
    pass
    
class ChannelAdmin(admin.ModelAdmin):
    pass

admin.site.register(MetricSummary, MetricSummaryAdmin)
admin.site.register(IncomingData, IncomingDataAdmin)
admin.site.register(Channel, ChannelAdmin)
