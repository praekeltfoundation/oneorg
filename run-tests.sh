#/bin/bash
eval cd go-js && npm install . && npm test
r1=$?
exit $(($r1))
