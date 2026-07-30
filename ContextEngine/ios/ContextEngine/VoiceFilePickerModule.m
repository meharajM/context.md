#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(VoiceFilePickerModule, NSObject)

RCT_EXTERN_METHOD(pickVoiceFile:(RCTPromiseResolveBlock)resolver
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
