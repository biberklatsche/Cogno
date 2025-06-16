// src/commands/crypto.rs

use aes::Aes256;
use block_modes::block_padding::Pkcs7;
use block_modes::{BlockMode, Cbc};
use hex::{decode, encode};
use rand::{rngs::OsRng, RngCore};
use ring::pbkdf2::{derive, PBKDF2_HMAC_SHA256};
use std::num::NonZeroU32;

// Konstanten
const SALT_LEN: usize = 16;
const IV_LEN: usize = 16;
const KEY_LEN: usize = 32;
const PBKDF2_ITERS: u32 = 100_000;

/// Leitet einen AES-256 Key aus Passwort und Salt ab mithilfe von `ring` PBKDF2
fn derive_key(password: &str, salt: &[u8]) -> [u8; KEY_LEN] {
    let mut key = [0u8; KEY_LEN];
    derive(
        PBKDF2_HMAC_SHA256,
        NonZeroU32::new(PBKDF2_ITERS).unwrap(),
        salt,
        password.as_bytes(),
        &mut key,
    );
    key
}

/// Verschlüsselt Text mit AES-256-CBC und gibt salt:iv:ciphertext im Hex-Format zurück
#[tauri::command]
pub fn encrypt(text: Option<String>, password: Option<String>) -> Result<String, String> {
    let plaintext = text.filter(|t| !t.is_empty()).ok_or("No text provided")?;

    let password = password
        .filter(|p| !p.is_empty())
        .ok_or("No password provided")?;

    // Zufälliges Salt und IV
    let mut salt = [0u8; SALT_LEN];
    let mut iv = [0u8; IV_LEN];
    OsRng.fill_bytes(&mut salt);
    OsRng.fill_bytes(&mut iv);

    let key = derive_key(&password, &salt);

    let cipher =
        Cbc::<Aes256, Pkcs7>::new_from_slices(&key, &iv).map_err(|_| "Failed to create cipher")?;

    let ciphertext = cipher.encrypt_vec(plaintext.as_bytes());

    Ok(format!(
        "{}:{}:{}",
        encode(salt),
        encode(iv),
        encode(ciphertext)
    ))
}

#[tauri::command]
pub fn decrypt(encrypted_text: Option<String>, password: Option<String>) -> Result<String, String> {
    let data = encrypted_text
        .filter(|e| !e.is_empty())
        .ok_or("No encrypted text provided")?;

    let password = password
        .filter(|p| !p.is_empty())
        .ok_or("No password provided")?;

    let parts: Vec<&str> = data.split(':').collect();
    if parts.len() != 3 {
        return Err("Invalid encrypted format".into());
    }

    let salt = decode(parts[0]).map_err(|_| "Failed to decode salt")?;
    let iv = decode(parts[1]).map_err(|_| "Failed to decode IV")?;
    let ciphertext = decode(parts[2]).map_err(|_| "Failed to decode ciphertext")?;

    let key = derive_key(&password, &salt);
    let cipher =
        Cbc::<Aes256, Pkcs7>::new_from_slices(&key, &iv).map_err(|_| "Cipher creation failed")?;

    let plaintext = cipher
        .decrypt_vec(&ciphertext)
        .map_err(|_| "Decryption failed")?;

    String::from_utf8(plaintext).map_err(|_| "Invalid UTF-8".into())
}
