use std::sync::OnceLock;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct AppIdentity {
    pub term_program_name: &'static str,
    pub home_directory_name: &'static str,
    pub development_home_directory_name: &'static str,
}

impl AppIdentity {
    pub const fn new(
        term_program_name: &'static str,
        home_directory_name: &'static str,
        development_home_directory_name: &'static str,
    ) -> Self {
        Self {
            term_program_name,
            home_directory_name,
            development_home_directory_name,
        }
    }
}

static APP_IDENTITY: OnceLock<AppIdentity> = OnceLock::new();

pub fn initialize_app_identity(app_identity: AppIdentity) {
    if let Some(existing_app_identity) = APP_IDENTITY.get() {
        if existing_app_identity == &app_identity {
            return;
        }

        panic!("App identity was already initialized with a different value.");
    }

    APP_IDENTITY
        .set(app_identity)
        .expect("App identity should be initialized exactly once.");
}

pub fn get_app_identity() -> &'static AppIdentity {
    APP_IDENTITY
        .get()
        .expect("App identity must be initialized before the Tauri core is used.")
}
