use zk_oracles::services::status_exchange_service::StatusExchangeService;
use zkcdid_lib_rs::models::{request_report::RequestReport, status_state::StatusState};


#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // let url = format!("http://{:?}:{:?}", config.get_oracle_domain(), config.get_oracle_server_port());
    let url = "http://oracle0:50051";
    println!("url={:?}", url);
    let statuses = vec![StatusState::get_sample_status()];
    let service = StatusExchangeService::new();
    let report = RequestReport::new(
        "0".to_string(),
        0,
        statuses.clone(),
    );
    let result = service.fulfill_request(&url, &report).await?;

    println!("RESULT={:?}", result);

    Ok(())
}