#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(VoiceFilePickerModule, NSObject)

RCT_EXTERN_METHOD(pickVoiceFile:(RCTPromiseResolveBlock)resolver
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(exportBackup:(NSString *)content
                  resolver:(RCTPromiseResolveBlock)resolver
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(pickBackupFile:(RCTPromiseResolveBlock)resolver
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
