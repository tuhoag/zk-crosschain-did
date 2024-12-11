use zk_oracles::services::status_exchange_service::StatusExchangeService;
use zkcdid_lib_rs::models::status_state::StatusState;


pub mod status_exchange {
    tonic::include_proto!("status_exchange");
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // let url = format!("http://{:?}:{:?}", config.get_oracle_domain(), config.get_oracle_server_port());
    let url = "http://oracle0:50051";
    println!("url={:?}", url);
    let statuses = vec![StatusState::get_sample_status()];
    let service = StatusExchangeService::new();
    let result = service.fulfill_request(&url, &statuses).await?;

    println!("RESULT={:?}", result);

    Ok(())
}