from django import forms
from metrics_manager.models import Channel
from celery_app.tasks import ingest_csv



class CSVUploader(forms.Form):
    csv = forms.FileField()
    channel = forms.ModelChoiceField(queryset=Channel.objects.all())

    def save(self):
        ingest_csv(self.cleaned_data["csv"], self.cleaned_data["channel"])
