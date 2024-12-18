use mongodb::Database;
use zkcdid_lib_rs::{models::oracle_request::OracleRequest, status_exchange::{self, status_exchange_service_server::{StatusExchangeService, StatusExchangeServiceServer}, HelloReply, HelloRequest}};
use tonic::{transport::Server, Request, Response, Status};
use zk_oracles::services::{oracle_manager_service, oracle_request_service::OracleRequestService, request_report_service::RequestReportService};
use zkcdid_lib_rs::{config::Config, models::request_report::RequestReport, utils::db};


#[derive(Debug, Default)]
pub struct MyStatusExchangeServer {}

#[tonic::async_trait]
impl StatusExchangeService for MyStatusExchangeServer {
    async fn say_hello(
        &self,
        request: Request<HelloRequest>,
    ) -> Result<Response<HelloReply>, Status> {

        println!("Got a request: {:?}", request);

        let reply = HelloReply {
            message: format!("Hello {}!", request.into_inner().name).into(),
        };

        Ok(Response::new(reply))
    }

    async fn fulfill_request(
        &self,
        request: Request<status_exchange::RequestFulfillment>,
    ) -> Result<Response<status_exchange::RequestFulfillmentResult>, Status> {
        println!("Got a request: {:?}", request);

        let config = Config::load_oracle_config();

        println!("Connecting to database...");
        let database: Database;
        loop {
            database = match db::get_db(&config).await {
                Ok(db) => db,
                Err(_) => continue,
            };
            break;
        }

        println!("Inserting or updating request report...");
        let report_service = RequestReportService::new(&database);
        let report = RequestReport::from(request.into_inner());

        match report_service.insert_or_update(&report).await {
            Ok(_) => println!("Request report inserted or updated successfully"),
            Err(e) => {
                println!("Error: {:?}", e);
                return Err(e.into());
            },
        }

        println!("Checking the number of reports is enough to fulfill the request...");
        let mechanism = report.statuses[0].status_mechanism;
        let oracle_manager_service = oracle_manager_service::OracleManagerService::new();
        // if oracle_manager_service.check_reports(&report.request_id, mechanism).await? {
        //     oracle_manager_service.send_reports_to_contract(&report.request_id).await?;
        // }

        let mechanism = report.statuses[0].status_mechanism;
        let num_reports = report_service.get_num_reports_by_request_id(&report.request_id, mechanism).await?;
        println!("Number of reports: {}", num_reports);

        // check the number of agreements
        let request_service = OracleRequestService::new(&database);
        // let request = request_service.find_one(&report.request_id, mechanism).await?;
        match request_service.find_one(&report.request_id, mechanism).await? {
            Some(r) => {
                println!("Number of agreements: {}", r.num_agreements);

                if r.num_agreements <= num_reports {
                    println!("All agreements are collected. Fulfilling the request...");
                    let reports = report_service.get_reports_by_request_id(&report.request_id, mechanism).await?;
                    // println!("Reports: {:?}", reports);

                    // send report to the contract
                    oracle_manager_service.send_last_status_to_contract(&report.request_id, &reports).await?;
                }
            },
            None => {
                return Err(Status::invalid_argument("Request not found"));
            }
        };

        let reply = status_exchange::RequestFulfillmentResult {
            result: true
        };

        Ok(Response::new(reply))
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let config = Config::load_oracle_config();
    let addr = format!("0.0.0.0:{}", config.get_server_port()).parse()?;
    let server = MyStatusExchangeServer::default();

    println!("zkOracle Server {} listening on {}", config.get_name(), addr);
    Server::builder()
        .add_service(StatusExchangeServiceServer::new(server))
        .serve(addr)
        .await?;

    Ok(())
}