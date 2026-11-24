//! What a process asks a Cogno through the host of its machine, and what the
//! Cogno answers (ARCHITECTURE.md 2.7.1, "Weitergabe"). The host routes it
//! by its addressee and reads none of it: it is this app's format, on both
//! ends - the `cogno` command line that asks and the app that answers.

use serde::{de::DeserializeOwned, Deserialize, Serialize};

/// A question for the Cogno that shows a terminal (`Addressee::Terminal`) or
/// owns a prompt session (`Addressee::PromptSession`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Question {
    /// `cogno action run`, typed in the terminal.
    RunAction { name: String, args: Vec<String> },
    /// What git or ssh asks; `token` is the one the session's processes got.
    Prompt { token: String, prompt: String },
    /// A question of a later Cogno.
    #[serde(other)]
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Answer {
    ActionRun {
        status: ActionRunStatus,
    },
    /// `None`: nobody answered, the prompt counts as refused.
    Prompt {
        answer: Option<String>,
    },
    /// The question was not one this Cogno knows.
    #[serde(other)]
    Unknown,
}

/// What became of `cogno action run`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ActionRunStatus {
    Dispatched,
    /// Its feature is off.
    Inactive,
    NotFound,
    #[serde(other)]
    Unknown,
}

/// As the host carries it: JSON text.
pub fn encode<T: Serialize>(message: &T) -> String {
    serde_json::to_string(message).expect("relayed messages serialize")
}

/// From the host's text; what this Cogno cannot read is `None`.
pub fn decode<T: DeserializeOwned>(text: &str) -> Option<T> {
    serde_json::from_str(text).ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_question_and_its_answer_cross_the_host_as_json() {
        let asked = Question::RunAction {
            name: "new_tab".into(),
            args: vec![],
        };
        assert_eq!(
            encode(&asked),
            r#"{"type":"runAction","name":"new_tab","args":[]}"#
        );
        assert_eq!(decode::<Question>(&encode(&asked)), Some(asked));

        let answered = Answer::ActionRun {
            status: ActionRunStatus::Inactive,
        };
        assert_eq!(decode::<Answer>(&encode(&answered)), Some(answered));
    }

    #[test]
    fn what_a_later_cogno_asks_or_answers_is_unknown_not_unreadable() {
        assert_eq!(
            decode::<Question>(r#"{"type":"somethingNew","x":1}"#),
            Some(Question::Unknown)
        );
        assert_eq!(
            decode::<Answer>(r#"{"type":"actionRun","status":"queued"}"#),
            Some(Answer::ActionRun {
                status: ActionRunStatus::Unknown
            })
        );
    }
}
