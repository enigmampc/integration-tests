#!/bin/bash

set -xe

CONTAINER_ID=$(docker container ls | grep enigmampc/client | cut -d' ' -f1)

rm -rf ../build ~/.enigma /tmp/enigma
mkdir -p ../build ~/.enigma /tmp/enigma

docker cp $CONTAINER_ID:/root/build/contracts ../build
sed -e 's_http://contract_http://localhost_g;s_http://bootstrap_http://localhost_g' ../build/contracts/addresses.json > ../build/contracts/addresses.new
mv ../build/contracts/addresses.new ../build/contracts/addresses.json

if [ ! -f .env ]; then
    echo "SGX_MODE=SW" > .env
    echo "ENIGMA_ENV=COMPOSE" >> .env
fi

wget -P enigma-js/lib https://raw.githubusercontent.com/enigmampc/enigma-contract/develop/enigma-js/lib/enigma-js.node.js