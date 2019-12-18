#!/bin/bash
CONTAINER_ID=$(docker container ls | grep enigmampc/client | cut -d' ' -f1)
mkdir -p ~/.enigma
mkdir -p ../build
docker cp $CONTAINER_ID:/root/build/contracts ../build
sed -e 's_http://contract_http://localhost_g;s_http://bootstrap_http://localhost_g' ../build/contracts/addresses.json > ../build/contracts/addresses.new
mv ../build/contracts/addresses.new ../build/contracts/addresses.json

if [ ! -f .env ]; then
    echo "SGX_MODE=SW" > .env
    echo "ENIGMA_ENV=COMPOSE" >> .env
fi

wget -P enigma-js/lib https://raw.githubusercontent.com/enigmampc/enigma-contract/develop/enigma-js/lib/enigma-js.node.js