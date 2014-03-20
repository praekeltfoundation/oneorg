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
