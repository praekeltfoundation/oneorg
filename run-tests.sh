#/bin/bash
eval python manage.py test
r1=$?
eval cd go-js && npm install . && npm test
r2=$?
exit $(($r1 + $r2))