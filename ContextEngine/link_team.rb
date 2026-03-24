require 'xcodeproj'
project_path = 'ios/ContextEngine.xcodeproj'
project = Xcodeproj::Project.open(project_path)

team_id = '5B5KHBC867'
bundle_id = 'com.meharaj.contextengine'

project.targets.each do |target|
  target.build_configurations.each do |config|
    config.build_settings['DEVELOPMENT_TEAM'] = team_id
    config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = bundle_id
    config.build_settings['CODE_SIGN_STYLE'] = 'Automatic'
  end
end

project.save
puts "Successfully linked project to Team ID: #{team_id} and set Bundle ID to: #{bundle_id}"
