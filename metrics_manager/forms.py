from django import forms
from metrics_manager.models import Channel
from celery_app.tasks import ingest_csv
from StringIO import StringIO

class CSVUploader(forms.Form):
    csv = forms.FileField()
    channel = forms.ModelChoiceField(queryset=Channel.objects.all())

    def save(self):
        csv_data = StringIO(self.cleaned_data["csv"].read())
        ingest_csv.delay(csv_data, self.cleaned_data["channel"])
