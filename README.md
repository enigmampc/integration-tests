# integration-tests

Integration test suite for the Enigma Protocol.

The contents of this repo are used in the [docker-environment](https://github.com/enigmampc/docker-environment) to create a `client` Docker image used to run these test automatically in our Continuous Integration (CI) environments.

## Running tests locally

This setup is only relevant for developers interested in manually debugging some of these tests, or wanting to tweak any particular test to adapt them to other applications:

1.  Clone this repo and change folders:

    ```bash
    git clone git@github.com:enigmampc/integration-tests.git integration-tests/integration-tests
    cd integration-tests/integration-tests
    ```

    Note: We clone to `integration-tests/integration-tests/` so when we run `local_init.bash` and it'll create the `../build/` directory it won't pollute the parent directory of `integration-tests/` which is probably `$HOME/projects`.

2.  Clone [docker-environment](https://github.com/enigmampc/docker-environment) elsewhere in your computer:

    ```bash
    git clone https://github.com/enigmampc/docker-environment
    ```

    In `docker-environment/.env` set `DOCKER_TAG=develop`.  
    In `docker-environment/docker-compose.yml`, under `bootstrap` add:

    ```
    ports:
      - 3346:3346
    ```

    and under `contract` add:

    ```
    ports:
      - 9545:9545
    ```

    You can run the script `./watch_is_ready.sh` to see when the network is ready (at least one worker registered).

3)  Once the network is fully up and running, run the following script once:

    ```bash
    ./local_init.bash
    ```

    Note: in the `wget` line inside `local_init.bash` you can point it to the right `enigma-contract` branch if it's not `develop`.

4)  Then you can run the integration tests:

    ```
    test/runTests.bash
    ```

    or any one individual test:

    ```
    yarn test calculator
    ```

    Please note that if you want to manually run them from inside the `test/` folder directly, you will have to copy the `.env` file there, or export these variable to the environment, for example:

    ```
    cd test
    SGX_MODE=SW ENIGMA_ENV=COMPOSE yarn test calculator
    ```
