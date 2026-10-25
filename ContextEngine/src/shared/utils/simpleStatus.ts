export function simpleStatus(status: string): string {
  if (/^waiting for device resources|^synthesis is waiting/i.test(status)) {
    return 'Your note is saved. The writing assistant will continue when your phone is ready.';
  }
  if (/^synthesis unavailable|^ai offline|^model missing/i.test(status)) {
    return 'The writing assistant is not ready yet. Your notes are still safe.';
  }
  if (/^audio unavailable/i.test(status)) return "Voice notes aren't ready yet.";
  if (/^downloading /i.test(status)) return 'Downloading the writing assistant…';
  if (/^processing \d+ thought/i.test(status)) return 'Organizing your notes…';
  if (/^needs topic choice|^waiting for your topic choice/i.test(status)) return 'Choose a topic to continue.';
  if (/^raw inbox persistence failed/i.test(status)) return "Couldn't save the note. Please try again.";
  if (/^import preview failed/i.test(status)) return "Couldn't prepare a preview. Please try again.";
  if (/^stored in context|^retained audio deleted/i.test(status)) return 'Done';
  if (/^saved to inbox:|^organized into |^note organized$/i.test(status)) return status;
  if (/^idle$|^capture ready$|^ready for local capture$/i.test(status)) return 'Ready';
  if (/^booting/i.test(status)) return 'Getting ready…';
  if (/^wake word|^lock-screen headset capture|^lock-screen capture unavailable/i.test(status)) {
    return 'Voice recording is not available right now.';
  }
  if (/^allow the requested permissions/i.test(status)) return 'Allow microphone access to record voice notes.';
  if (/^enable push to record/i.test(status)) return 'Turn on voice recording in Settings first.';
  if (/^selected .*download required/i.test(status)) return 'Writing assistant selected · download needed';
  if (/^selected /i.test(status)) return 'Writing assistant selected';
  if (/^downloaded /i.test(status)) return 'Writing assistant downloaded';
  if (/^removed /i.test(status)) return 'Writing assistant removed';
  if (/^installed .*synthesis could not start/i.test(status)) {
    return "The writing assistant couldn't start. Your notes are still saved in Inbox. Please try again.";
  }
  if (/^model (download|selection) failed/i.test(status)) return "Couldn't update the writing assistant. Please try again.";
  if (/^previewing /i.test(status)) return 'Preparing preview…';
  if (/^queued item updated/i.test(status)) return 'Note updated';
  if (/^queue item ended/i.test(status)) return 'Note removed from waiting list';
  if (/^retained audio deletion failed|^retained audio could not be removed/i.test(status)) {
    return "Couldn't delete the recording. Please try again.";
  }
  if (/^retained audio deleted/i.test(status)) return 'Recording deleted';
  if (/^only unsynthesized/i.test(status)) return 'Only notes in Inbox can be deleted here.';
  if (/^wait for this note/i.test(status)) return 'Wait until this note is ready, then try again.';
  if (/^voice capture needs attention|^recording unavailable/i.test(status)) return 'Voice recording is not ready. You can still type a note.';
  if (/^only context engine retained audio/i.test(status)) return 'This recording cannot be deleted here.';
  if (/^queued item cannot be updated|^active item cannot be ended/i.test(status)) return 'Please wait until the note is ready, then try again.';
  if (/^choose one of the suggested topics/i.test(status)) return 'Choose one of the topics to continue.';
  if (/^resuming synthesis/i.test(status)) return 'Organizing your notes…';
  if (/^stored for later|^voice note queued/i.test(status)) return 'Saved for later';
  if (/^saved in inbox\. android will retry|^saved in inbox\. android could not schedule/i.test(status)) return status;
  if (/^saved in inbox/i.test(status)) return 'Saved in Inbox. The assistant will try again when your phone is ready.';
  if (/(synthesis|transcri|whisper|litert|\bram\b|backend|runtime|\bmodel\b)/i.test(status)) {
    return 'Something needs attention. Please try again.';
  }
  return status;
}
