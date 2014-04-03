one.org doagric project
===============

A Django application that allows for ingest of CSV's from social
networks and a multi-country USSD application for user interaction.

Django
---------

::

    $ virtualenv ve
    $ source ve/bin/activate
    (ve)$ pip install -r requirements.pip

USSD
---------

::

    $ cd go-js
    $ npm install .
    $ ./node_modules/.bin/mocha -R spec --watch


Metrics Dashboard
------------------

South Africa
~~~~~~~~~~~~~~

    **Total Campaign Actions**
    This line graph will plot the total campaign actions completed across all channels in all countries.
    metric: supporter
    widget: lvalue

    **Total Campaign Actions per country**
    This line graph will plot the total campaign actions per country since launch.
    metrics: za.supporter, ng.supporter
    widget: graph

    **Total Campaign Actions South Africa (line graph widget)**
    This line graph widget will contain the total campaign actions in South Africa per month for a year default beginning 1 January ending 31 December.
    metric: za.supporter
    widget: graph

    **Total USSD Actions South Africa (line graph widget)**
    This line graph widget will contain the total campaign actions completed via USSD in South Africa per month for a year default beginning 1 January ending 31 December.
    metric: za.ussd.supporter
    widget: graph

    **Total Mxit Actions South Africa (line graph widget)**
    This line graph widget will contain the total campaign actions completed via Mxit in South Africa per month for a year default beginning 1 January ending 31 December.
    metric: za.mxit.supporter
    widget: graph
    
    **Total 2go Actions South Africa (line graph widget)**
    This line graph widget will contain the total campaign actions completed via 2go in South Africa per month for a year default beginning 1 January ending 31 December.
    *Not currently active*
    metric: za.2go.supporter
    widget: graph

    **Total Facebook Actions South Africa (line graph widget)**
    This line graph widget will contain the total campaign actions completed via Facebook in South Africa per month for a year default beginning 1 January ending 31 December.
    metric: za.facebook.supporter
    widget: graph

    **Total Twitter Actions South Africa (line graph widget)**
    This line graph widget will contain the total campaign actions completed via Twitter in South Africa per month for a year default beginning 1 January ending 31 December.
    metric: global.twitter.supporter
    widget: graph

    **Total Song Downloads South Africa - Ringback (text widget)**
    This text widget shows the total song downloads for South Africa.
    metric: za.ussd.request.ringback
    widget: lvalue

    **Total Song Downloads South Africa - MP3 (text widget)**
    This text widget shows the total song downloads for South Africa.
    metric: za.ussd.request.mp3
    widget: lvalue
