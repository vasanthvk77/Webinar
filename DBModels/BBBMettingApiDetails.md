Here is the create call with the parameters from the BBB 4.0 docs. I only read part of that docs page, so a rarely used parameter could be missing.

Example URL (values are examples; replace them)

https://bbb.test/bigbluebutton/api/create
  ?name=Webinar%20101
  &meetingID=webinar-101
  &welcome=Welcome%20to%20%25%25CONFNAME%25%25
  &maxParticipants=500
  &duration=120
  &record=false
  &logoutURL=https%3A%2F%2Fyourapp.com%2Fthanks
  &meetingExpireIfNoUserJoinedInMinutes=30
  &meetingExpireWhenLastUserLeftInMinutes=5
  &guestPolicy=ALWAYS_ACCEPT
  &muteOnStart=true
  &endWhenNoModerator=false
  &meetingLayout=UNIFIED_LAYOUT
  &meta_webinarId=101
  &checksum=<hash>

(In a real call it is a single line with no spaces.)

Required

Param	Value
name	2 to 64 characters
meetingID	Your ID, 2 to 256 characters, no commas
checksum	SHA-1 of create + query string + secret

Optional

Param	Notes
welcome	Welcome message. %%CONFNAME%%, %%DIALNUM%% and %%CONFNUM%% get replaced
moderatorOnlyMessage	Message only moderators see
maxParticipants	Cap on concurrent users
duration	Maximum length in minutes
record	true or false. Default is false
autoStartRecording	Start recording on its own
allowStartStopRecording	Default true
logoutURL	Where users go after leaving
meetingEndedURL	Server-to-server callback when the meeting ends
meetingExpireIfNoUserJoinedInMinutes	Default 5
meetingExpireWhenLastUserLeftInMinutes	Default 1
endWhenNoModerator	End the meeting when no moderator is left
guestPolicy	ALWAYS_ACCEPT (default), ALWAYS_DENY, ASK_MODERATOR
muteOnStart	Start users muted
meetingLayout	Default UNIFIED_LAYOUT
lockSettingsDisableCam, ...Mic, ...PrivateChat, ...PublicChat, ...Notes, ...HideUserList, ...HideViewersCursor, ...HideViewersAnnotation	All default false
lockSettingsLockOnJoin	Default true
lockSettingsLockOnJoinConfigurable	Default false
lockSettingsPresenterPolicy	moderatorOnly, requireApproval (default) or freeForAll
disabledFeatures, groups, logo, bannerText, bannerColor	Branding and feature switches
meta_*	Your own metadata. Returned by getMeetingInfo and getRecordings