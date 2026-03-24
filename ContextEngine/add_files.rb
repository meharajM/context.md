require 'xcodeproj'
project_path = 'ios/ContextEngine.xcodeproj'
project = Xcodeproj::Project.open(project_path)

# Set Development Team
team_id = '5B5KHBC867'

project.targets.each do |target|
  target.build_configurations.each do |config|
    config.build_settings['DEVELOPMENT_TEAM'] = team_id
    config.build_settings['CODE_SIGN_STYLE'] = 'Automatic'
  end
end

# Find the main group
main_group = project.main_group.find_subpath('ContextEngine', true)

# Add Native Modules
['EventEmitter.swift', 'EventEmitter.m'].each do |filename|
  file_exists = main_group.files.any? { |f| f.path == filename }
  unless file_exists
    file_ref = main_group.new_file(filename)
    target = project.targets.find { |t| t.name == 'ContextEngine' }
    target.add_file_references([file_ref])
  end
end

# Add Assets & Models
assets_group = main_group.find_subpath('Assets', true)
models_group = assets_group.find_subpath('models', true)

# Whisper Model
unless assets_group.files.any? { |f| f.path == 'whisper-tiny.en.bin' }
  file_ref = assets_group.new_file('whisper-tiny.en.bin')
  target = project.targets.find { |t| t.name == 'ContextEngine' }
  target.resources_build_phase.add_file_reference(file_ref)
end

# LLM Model
unless models_group.files.any? { |f| f.path == 'tinyllama.gguf' }
  file_ref = models_group.new_file('tinyllama.gguf')
  target = project.targets.find { |t| t.name == 'ContextEngine' }
  target.resources_build_phase.add_file_reference(file_ref)
end

project.save
puts "Configured Code Signing, Assets, and LLM Model for Team ID: #{team_id}"
