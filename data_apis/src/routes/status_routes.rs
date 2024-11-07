use actix_web::{web::{self, Data, Json}, Responder};

use crate::{errors::AppResult, models::{request_params::StatusQueryParams, status_state::{StatusMechanism, StatusState, StatusType}}, utils::AppData};

async fn get_all_statuses(status_mechanism: web::Path<(StatusMechanism, StatusType)>, query: web::Query<StatusQueryParams>, app_data: Data<AppData>) -> AppResult<impl Responder> {
    let service = &app_data.status_service;
    let (status_mechanism, status_type) = *status_mechanism;
    let statuses = service.get_statuses(&status_mechanism, &status_type, &query).await?;
    Ok(Json(statuses))
}

async fn get_latest_statuses(status_mechanism: web::Path<(StatusMechanism, StatusType)>, app_data: Data<AppData>) -> AppResult<impl Responder> {
    let service = &app_data.status_service;
    let (status_mechanism, status_type) = *status_mechanism;
    let status = service.get_latest_status(&status_mechanism, &status_type).await?;
    Ok(Json(status))
}

async fn get_sample() -> AppResult<impl Responder> {
    let sample = StatusState::get_sample_status();
    Ok(Json(sample))
}

pub fn initialize(config: &mut web::ServiceConfig) {
    config.service(
        web::scope("/statuses/{status_mechanism}/{status_type}")
            .route("", web::get().to(get_all_statuses))
            .route("/latest", web::get().to(get_latest_statuses))
            .route("/sample", web::get().to(get_sample)),
    );
}