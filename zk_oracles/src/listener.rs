use zk_oracles::{errors::OracleResult, services::oracle_manager_service::OracleManagerService};

async fn initialize() -> OracleResult<()> {
    // register this oracle to the smart contract
    let manager_service = OracleManagerService::new();
    let config = &manager_service.config;

    while let Ok(false) = manager_service.is_this_oracle_registered().await {
        println!("Oracle is not registered. Registering...");

        match manager_service.add_its_own_oracle().await {
            Ok(_) => {
                if let Ok(true) = manager_service.is_this_oracle_registered().await {
                    println!("Oracle registered successfully!. Waiting to check its registration correctness...");
                    break;
                }
            },
            Err(e) => {
                println!("Error registering oracle: {:?}", e);
                println!("Retrying in {:?} seconds...", config.get_waiting_interval());
                tokio::time::sleep(tokio::time::Duration::from_secs(config.get_waiting_interval())).await;
            }
        }
    }

    Ok(())
}

async fn listen() -> OracleResult<()> {
    // listen for events from the chain
    let manager_service = OracleManagerService::new();
    println!("Listening for events from OracleManager contract at {:?}...", manager_service.contract_address);

    loop {
        match manager_service.listen_for_requests().await {
            Ok(_) => {},
            Err(e) => {
                println!("Error listening for requests: {:?}", e);
                println!("Retrying in {:?} seconds...", manager_service.config.get_waiting_interval());
                tokio::time::sleep(tokio::time::Duration::from_secs(manager_service.config.get_waiting_interval())).await;
            }
        }
    }
}


#[tokio::main]
async fn main() -> OracleResult<()> {
    // initialize the oracle
    initialize().await?;

    // listen for events from the chain
    listen().await?;

    Ok(())
}