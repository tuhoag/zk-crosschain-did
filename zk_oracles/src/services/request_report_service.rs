use std::collections::HashMap;

use bson::{doc, oid::ObjectId, Bson};
use futures_util::TryStreamExt;
use mongodb::{Collection, Database};
use zkcdid_lib_rs::{config::Config, models::{request_report::RequestReport, status_state::StatusMechanism}};

use crate::errors::{OracleError, OracleResult};

pub struct RequestReportService {
    pub collections: HashMap<StatusMechanism, Collection<RequestReport>>,
}

impl RequestReportService {
    pub fn new(database: &Database) -> Self {
        let config = Config::load_oracle_config();

        Self {
            collections: [
                (StatusMechanism::BitStatusList, database.collection(&format!("{}_bsl", config.get_reports_collection_name()))),
                (StatusMechanism::MerkleTree, database.collection(&format!("{}_merkle", config.get_reports_collection_name()))),
            ].into_iter().collect(),
        }
    }

    pub async fn is_existed(&self, request_id: &str, oracle_id: u8, status_mechanism: StatusMechanism) -> OracleResult<bool> {
        let collection = self.collections.get(&status_mechanism).unwrap();

        let query = doc! {
            "$and": [
                doc! { "request_id": doc! { "$eq": request_id } },
                doc! { "oracle_id": doc! { "$eq": oracle_id as i32 } },
            ]
        };

        let cursor = collection
            .find(query)
            .await?;
        let requests = cursor.try_collect::<Vec<RequestReport>>().await?;

        Ok(requests.len() > 0)
    }

    pub async fn insert_one(&self, request: &RequestReport) -> OracleResult<()> {
        if request.statuses.is_empty() {
            return Err(OracleError::CommonError("Request must have at least one status".to_string()));
        }

        let mechanism = request.statuses[0].status_mechanism;

        if self.is_existed(&request.request_id, request.oracle_id, mechanism).await? {
            return Err(OracleError::CommonError("Report already existed".to_string()));
        }

        let collection = self.collections.get(&mechanism).unwrap();
        collection.insert_one(request).await?;
        Ok(())
    }

    pub async fn find_one(&self, request: &RequestReport) -> OracleResult<Option<RequestReport>> {
        if request.statuses.is_empty() {
            return Err(OracleError::CommonError("Request must have at least one status".to_string()));
        }

        let mechanism = request.statuses[0].status_mechanism;
        let collection = self.collections.get(&mechanism).unwrap();

        println!("Querying request report: request_id={:?}, oracle_id={:?}", request.request_id, request.oracle_id);
        let query = doc! {
            "$and": [
                doc! { "request_id": doc! { "$eq": request.request_id.to_string() } },
                doc! { "oracle_id": doc! { "$eq": request.oracle_id as i32 } },
            ]
        };

        let result = collection.find_one(query).await?;

        println!("Found request report: {:?}", result);
        Ok(result)
    }

    pub async fn update_one(&self, id: &ObjectId, request: &RequestReport) -> OracleResult<()> {
        if request.statuses.is_empty() {
            return Err(OracleError::CommonError("Request must have at least one status".to_string()));
        }

        let find_filter = doc! {
            "_id": id,
        };

        let bson_statuses = request.statuses.iter().map(|status| bson::to_bson(&status)).collect::<Result<Vec<Bson>, _>>()?;

        let update_doc = doc! {
            "$set": {
                "statuses": bson_statuses,
            }
        };

        println!("Updating request report id {:?}: {:?}", find_filter, update_doc);
        let mechanism = request.statuses[0].status_mechanism;
        let collection = self.collections.get(&mechanism).unwrap();

        collection.update_one(find_filter, update_doc).await?;
        Ok(())
    }

    pub async fn insert_or_update(&self, request: &RequestReport) -> OracleResult<()> {
        let stored_report = self.find_one(request).await?;

        match stored_report {
            Some(stored_report) => {
                println!("Found stored report: {:?}", stored_report);
                println!("Updating report...");
                self.update_one(stored_report.id.as_ref().unwrap(), request).await?
            },
            None => {
                println!("Stored report not found. Inserting new report...");
                self.insert_one(request).await?
            },
        }

        Ok(())
    }

    pub async fn get_reports_by_request_id(&self, request_id: &str, mechanism: StatusMechanism) -> OracleResult<Vec<RequestReport>> {
        let collection = self.collections.get(&mechanism).unwrap();

        let query = doc! {
            "request_id": doc! { "$eq": request_id }
        };

        let cursor = collection
            .find(query)
            .await?;
        let requests = cursor.try_collect::<Vec<RequestReport>>().await?;

        Ok(requests)
    }

    pub async fn get_num_reports_by_request_id(&self, request_id: &str, mechanism: StatusMechanism) -> OracleResult<u8> {
        let collection = self.collections.get(&mechanism).unwrap();

        let query = doc! {
            "request_id": doc! { "$eq": request_id }
        };

        let num_reports = collection
            .count_documents(query)
            .await?;

        Ok(num_reports as u8)
    }
}