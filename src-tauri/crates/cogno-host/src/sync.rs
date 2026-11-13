//! Locks that outlive a panic.
//!
//! A thread that panics while it holds a lock poisons it, and every later
//! `lock().unwrap()` panics too: one failed request would take the daemon's
//! request threads and its idle watch with it, and the daemon would never end.
//! What the host keeps under its locks stays consistent between statements,
//! so it goes on with the data as the panicking thread left it.

use std::sync::{Mutex, MutexGuard, PoisonError};

pub fn lock<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(PoisonError::into_inner)
}
