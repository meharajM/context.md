#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(EventEmitter, RCTEventEmitter)

RCT_EXTERN_METHOD(announceGuidance:(NSString *)text)

@end

@interface RCT_EXTERN_MODULE(AudioPlayerModule, NSObject)

RCT_EXTERN_METHOD(play:(NSString *)filePath resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(stop)

@end
