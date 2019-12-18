#!/bin/bash
CONTAINER_ID=$(docker container ls | grep enigmampc/client | cut -d' ' -f1)
mkdir -p ~/.enigma
mkdir -p ../build
docker cp $CONTAINER_ID:/root/build/contracts ../build
sed -e 's_http://contract_http://localhost_g;s_http://bootstrap_http://localhost_g' ../build/contracts/addresses.json > ../build/contracts/addresses.new
mv ../build/contracts/addresses.new ../build/contracts/addresses.json