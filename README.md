# integration-tests
Integration test suite for the Discovery release of the Enigma Protocol.

The contents of this repo are used in the [docker-environment](https://github.com/enigmampc/docker-environment) to create a `client` Docker image used to run these test automatically in our Continuous Integration (CI) environments.

## Running tests locally

This setup is only relevant for developers interested in manually debugging some of these tests, or wanting to tweak any particular test to adapt them to other applications: 

1. Add an `.env` file with the following (and choose either `SW` or `HW` for `SGX_MODE)`

    ```
    SGX_MODE=SW
    ENIGMA_ENV=COMPOSE
    ```

2. Create the following folder:

    ```
    mkdir enigma-js/lib
    ```

3. Download and save this file inside the folder you created in the previous step: [enigma-js.node.js](https://raw.githubusercontent.com/enigmampc/enigma-contract/develop/enigma-js/lib/enigma-js.node.js)

2. Clone [docker-environment](https://github.com/enigmampc/docker-environment) elsewhere in your computer, configure it, and start it.

3. Once the network is fully up and running, run the following script once:

    ```
    ./local_init.bash
    ```

4. Then you can run the integration tests:

    ```
    test/runTests.bash
    ```

    or any one individual test:

    ```
    yarn test test/02_deploy_calculator.spec.js 
    ```

    please note that if you want to manually run them from inside the `test/` folder directly, you will have to copy the `.env` file there, or export these variable to the environment, for example:

    ```
    cd test
    SGX_MODE=SW ENIGMA_ENV=COMPOSE yarn test 02_deploy_calculator.spec.js
    ```