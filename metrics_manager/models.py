from django.db import models


# Create your models here.

class MetricSummary(models.Model):
    country_code = models.CharField(max_length=2)
    channel = models.CharField(max_length=10)
    metric = models.CharField(max_length=50)
    total = models.IntegerField()

    class Meta:
        verbose_name = "Metric Summary"
        verbose_name_plural = "Metric Summaries"


class IncomingData(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    source_timestamp = models.DateTimeField()
    channel = models.CharField(max_length=10)
    channel_uid = models.CharField(max_length=255)
    msisdn = models.CharField(max_length=100,null=True, blank=True)
    email = models.CharField(max_length=255,null=True, blank=True)
    name = models.CharField(max_length=255, null=True, blank=True)
    farmer = models.NullBooleanField(null=True, blank=True)
    budget_enough = models.NullBooleanField(null=True, blank=True)
    budget_think = models.CharField(max_length=5, null=True, blank=True)
    budget_should = models.CharField(max_length=5, null=True, blank=True)
    sex = models.CharField(max_length=6, null=True, blank=True)
    age = models.CharField(max_length=5, null=True, blank=True)
    country_code = models.CharField(max_length=2, null=True, blank=True)
    location = models.CharField(max_length=100, null=True, blank=True)
    download_mp3 = models.NullBooleanField(null=True, blank=True)
    download_ringback = models.NullBooleanField(null=True, blank=True)

    def __unicode__(self):
        return "%s - %s" % (self.source_timestamp, self.channel_uid)

    class Meta:
        verbose_name = "Incoming Data"
        verbose_name_plural = "Incoming Data"
