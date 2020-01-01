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

    Note: Inside `integration-tests/integration-tests/` so when `local_init.bash` will create the `../build/` directory it won't pollute the parent directory of `integration-tests/` which is probably `$HOME/projects`.

2.  Clone [docker-environment](https://github.com/enigmampc/docker-environment) elsewhere in your computer, configure it, and start it with `docker-compose up`.

3.  Once the network is fully up and running, run the following script once:

    ```bash
    ./local_init.bash
    ```

4.  Then you can run the integration tests:

    ```
    test/runTests.bash
    ```

    or any one individual test:

    ```
    yarn test test/02_deploy_calculator.spec.js
    ```

    Please note that if you want to manually run them from inside the `test/` folder directly, you will have to copy the `.env` file there, or export these variable to the environment, for example:

    ```
    cd test
    SGX_MODE=SW ENIGMA_ENV=COMPOSE yarn test 02_deploy_calculator.spec.js
    ```
