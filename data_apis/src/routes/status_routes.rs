use actix_web::{web::{self, Data}, HttpResponse, Responder};

use crate::{models::{request_params::StatusQueryParams, status_state::{StatusState, StatusType}}, utils::AppData};

async fn get_all_statuses(status_type: web::Path<StatusType>, query: web::Query<StatusQueryParams>, app_data: Data<AppData>) -> impl Responder {
    let service = &app_data.status_service;
    match service.get_statuses(*status_type, &query).await {
        Ok(statuses) => HttpResponse::Ok().json(statuses),
        Err(e) => HttpResponse::InternalServerError().body(format!("Error getting statuses: {}", e)),
    }
}

async fn get_latest_statuses(status_type: web::Path<StatusType>, app_data: Data<AppData>) -> impl Responder {
    let service = &app_data.status_service;
    match service.get_latest_status(*status_type).await {
        Ok(statuses) => HttpResponse::Ok().json(statuses),
        Err(e) => HttpResponse::InternalServerError().body(format!("Error getting latest status: {}", e)),
    }
}

async fn get_sample() -> impl Responder {
    let sample = StatusState::get_sample_status();
    HttpResponse::Ok().json(sample)
}

pub fn initialize(config: &mut web::ServiceConfig) {
    config.service(
        web::scope("/statuses/{status_type}")
            .route("", web::get().to(get_all_statuses))
            .route("/latest", web::get().to(get_latest_statuses))
            .route("/sample", web::get().to(get_sample)),
    );
}