(function() {
  'use strict';

  angular
    .module('bd.app')
    .value('ReadOnlyStore', ReadOnlyStore)
    .value('ProjectLocalStore', ProjectLocalStore)
    .factory('projectManager', projectManager);


  function ReadOnlyStore(projectData) {
    this.readOnly = true;
    this.projectData = projectData;
  }

  ReadOnlyStore.prototype.getProject = function(projectId) {
    return {
      id: 1,
      name: this.projectData.name,
      tracks: this.projectData.tracks,
      audioTrack: this.projectData.audioTrack,
      sections: this.projectData.index,
      playlists: this.projectData.playlists || [],
      script: this.projectData.script
    };
  }

  ReadOnlyStore.prototype.getSection = function(sectionId) {
    var index = this.projectData.index.findIndex(byId(sectionId));
    var section = this.projectData.sections[index];
    section.name = this.projectData.index[index].name;
    section.id = this.projectData.index[index].id;
    return section;
  };



  function ProjectLocalStore() {
    this.readOnly = false;
    this.PROJECTS_KEY = 'bd.projects';
    this.projects = this.projectsList();
  }

  function projectKey(projectId) {
    return 'bd.project.{0}'.format(projectId);
  }
  function playlistsKey(projectId) {
    return 'bd.playlists.{0}'.format(projectId);
  }
  function sectionKey(projectId, sectionId) {
    return 'bd.section.{0}.{1}'.format(projectId, sectionId);
  }

  ProjectLocalStore.prototype.save = function(key, value) {
    localStorage.setItem(key, LZString.compressToUTF16(value));
  }

  ProjectLocalStore.prototype.read = function(key, def) {
    var value = localStorage.getItem(key);
    if (value) {
      if (value[0] !== '{' && value[0] !== '[') {
        value = LZString.decompressFromUTF16(value);
      }
      return JSON.parse(value);
    }
    return def;
  }

  ProjectLocalStore.prototype._updateProjectsOrder = function(latestProjectId) {
    var index = this.projects.findIndex(byId(latestProjectId));
    if (index !== -1) {
      var item = this.projects.splice(index, 1)[0];
      this.projects.splice(0, 0, item);
      var data = angular.toJson(this.projects);
      this.save(this.PROJECTS_KEY, data);
    }
  };

  ProjectLocalStore.prototype.projectsList = function() {
    return this.read(this.PROJECTS_KEY, []);
  };


  ProjectLocalStore.prototype.getProject = function(projectId) {
    var projectConfig = this.read(projectKey(projectId));
    var playlists = this.read(playlistsKey(projectId), []);
    this.project = {
      id: projectId,
      upload_id: projectConfig.upload_id || '',
      name: projectConfig.name,
      sections: projectConfig.sections,
      tracks: projectConfig.tracks,
      audioTrack: projectConfig.audioTrack,
      playlists: playlists,
      script: projectConfig.script
    };
    this._updateProjectsOrder(projectId);
    return this.project;
  };

  ProjectLocalStore.prototype.createProject = function(projectName) {
    console.log('Initialize project: '+projectName);
    // generate new unique project id
    var id = this.projects.reduce(function(value, projectRecord) {
      return projectRecord.id >= value? projectRecord.id+1 : value;
    }, 1);
    var id = generateItemId(this.projects);
    this.project = {
      name: projectName,
      id: id,
      sections: [],
      tracks: []
    };
    this.projects.splice(0, 0, {
      id: this.project.id,
      name: this.project.name
    });

    var data = angular.toJson(this.projects);
    this.save(this.PROJECTS_KEY, data);
    return this.project;
  };

  ProjectLocalStore.prototype.saveProjectConfig = function(tracksInfo, sectionsIndex) {
    var projectId = this.project.id;
    console.log('ProjectLocalStore.saveProjectConfig: '+projectKey(projectId));
    this.project.tracks = tracksInfo;
    
    // filter only already saved sections
    this.project.sections = sectionsIndex.filter(function(record) {
      return this.project.sections.some(function(s) {
        return s.id === record.id;
      });
    }, this);

    var data = JSON.stringify(this.project, function(k, v) {
      if (k === 'playlists') {
        return undefined;
      }
      if (k.startsWith('$$')) { // clean JSON from Angular hashes
        return undefined;
      }
      return v;
    });
    this.save(projectKey(projectId), data)
  };

  ProjectLocalStore.prototype.deleteProject = function(projectId) {
    if (this.project.id === projectId) {
      console.log('!! deleting opened project !!');
      return;
    }
    var projectConfig = this.read(projectKey(projectId));
    if (projectConfig) {
      var keys = projectConfig.sections.map(
        function(section) {
          return sectionKey(projectId, section.id);
        }
      );
      keys.push(playlistsKey(projectId));
      keys.push(projectKey(projectId));
      keys.forEach(localStorage.removeItem, localStorage);
    }

    // update index of projects
    var projects = this.projectsList();
    var index = projects.findIndex(byId(projectId));
    if (index !== -1) {
      projects.splice(index, 1);
      this.save(this.PROJECTS_KEY, angular.toJson(projects));
    }
    this.projects = projects;
  };

  ProjectLocalStore.prototype.saveSection = function(sectionId, sectionName, serializedData) {
    var key = sectionKey(this.project.id, sectionId);
    console.log('ProjectLocalStore.saveSection: '+key);

    var sectionIndexExists = this.project.sections.some(function(s) {
      return s.id === sectionId;
    });
    if (!sectionIndexExists) {
      this.project.sections.push({
        id: sectionId,
        name: sectionName
      });
    }
    this.save(key, serializedData);
  };

  ProjectLocalStore.prototype.getSection = function(sectionId) {
    if (!this.project) {
      return;
    }
    var key = sectionKey(this.project.id, sectionId);
    var data = this.read(key);
    if (data) {
      data.id = sectionId;
      return data;
    }
  };

  ProjectLocalStore.prototype.deleteSection = function(sectionId) {
    var key = sectionKey(this.project.id, sectionId);
    localStorage.removeItem(key);
  };

  ProjectLocalStore.prototype.savePlaylists = function(playlists) {
    var key = playlistsKey(this.project.id);
    console.log('ProjectLocalStore.savePlaylists: '+key);
    this.save(key, angular.toJson(playlists))
  };

  ProjectLocalStore.prototype._projectData = function() {
    var projectId = this.project.id;
    var projectConfig = this.read(projectKey(projectId));
    var playlists = this.read(playlistsKey(projectId), []);
    var sections = projectConfig.sections.map(function(sectionIndex) {
      return this.read(sectionKey(projectId, sectionIndex.id));
    }, this);
    var data = {
      name: projectConfig.name,
      index: projectConfig.sections,
      tracks: projectConfig.tracks,
      audioTrack: projectConfig.audioTrack,
      playlists: playlists,
      sections: sections,
    };
    if (projectConfig.script) {
      data.script = projectConfig.script;
    }
    return data;
  }


  function generateItemId(list) {
    return list.reduce(
      function(value, item) {
        return item.id >= value? item.id+1 : value;
      }, 1
    );
  }

  function byId(id) {
    return function(item) {
      return item.id === id;
    }
  }

  function projectManager($http, $q, $mdDialog, $mdToast, Observable, context,
      Bass, Drums, Piano, DrumTrackSection, TrackSection, AudioTrack, StreamAudioTrack, Config) {

    var idCouter = {};

    function ProjectManager() {
      this.store = new ProjectLocalStore();
      Observable.call(this, [
        "projectLoaded", "playlistLoaded",
        "sectionLoaded", "sectionDeleted", "sectionCreated"
      ]);
    }
    ProjectManager.prototype = Object.create(Observable.prototype);

    ProjectManager.prototype.addTrack = function(track) {
      if (angular.isUndefined(idCouter[track.type])) {
        idCouter[track.type] = 0;
      }
      track.id = track.type+'_'+idCouter[track.type];
      // console.log(track.kit)
      if (track.kit === 'Standard') {
        track.kit = 'Drums';
        track.name = track.kit;
      } /*else if (track.kit === 'Bongo') {
        track.kit = 'Percussions';
        track.name = track.kit;
      }*/

      if (track.type === 'piano') {
        track.range = track.range || ['C2', 'B5'];
        track.preset = track.preset || 'acoustic';
        track.instrument = new Piano(track);
      } else {
        track.instrument = (track.type === 'bass')? new Bass(track) : Drums[track.kit];
      }

      track.audio = AudioTrack(context);
      // var panNode = context.createStereoPanner();
      // panNode.pan.value = 1;
      // track.audio.add(panNode);

      if (track.type !== 'drums') {
        track.audio.addCompressor({
          threshold: -35,
          knee: 40,
          ratio: 12,
          attack: 0
        });
      }

      if (track.volume) {
        track.audio.volume = track.volume.value;
        track.audio.muted = track.volume.muted;
      }
      track.solo = false;

      var index = this.project.tracks.length;
      this.project.tracks.forEach(function(t, i) {
        if (t.type === track.type) {
          index = i+1;
        }
      });
      this.project.tracks.splice(index, 0, track);
      this.project.tracksMap[track.id] = track;
      idCouter[track.type] += 1;
      // TODO: add track for every existing section, or do it lazy
    };


    ProjectManager.prototype.removeTrack = function(trackId) {
      var index = this.project.tracks.findIndex(byId(trackId));
      this.project.tracks.splice(index, 1);
      delete this.section[trackId];
      delete this.project.tracksMap[trackId];
    };


    function findBestStream(formats) {
      // console.log(formats)
      var formats = formats.filter(function(f) {
        // return f.vcodec === "none" && f.protocol === 'https';
        return f.protocol === 'https';
      });

      if (window.runtime.mp4Support) {
        var mp4 = formats.find(function(f) { return f.format_id === '140' });
        if (mp4) {
          return mp4;
        }
      }

      if (window.runtime.oggSupport) {
        var webmFormats = formats.filter(function(f) {
          return f.ext === 'webm' || f.acodec === 'opus' || f.acodec === 'vorbis';
        });
        if (webmFormats.length) {
          formats = webmFormats;
        }
      }
      var minAbr = window.runtime.mobile? 40 : 60;

      return formats.find(function(f) {
        return f.abr >= minAbr;
      }) || formats[0];
    }

    function extractStreamUrl(resource) {
      var task = $q.defer();
      $http.get(Config.apiUrl+'online_stream/?url='+encodeURIComponent(resource)).then(function(resp) {
        var format = findBestStream(resp.data.formats);
        if (format) {
          console.log(format)
          format.extractor = resp.data.extractor;
          task.resolve(format);
        } else {
          task.reject();
        }
      }).catch(task.reject);
      return task.promise;
    }

    ProjectManager.prototype.addOnlineStreamTrack = function(resource) {
      var task = $q.defer();
      var requiresExtraction = /youtube|soundcloud/i.test(resource);
      (requiresExtraction? extractStreamUrl(resource) : $q.when({extractor: 'raw', url: resource}))
        .then(function(stream) {
          var config = {
            resource: resource,
            type: stream.extractor
          };

          if (window.runtime.mobile) {

            var pm = this;
            var confirm = {
              template: 
                '<md-dialog-content class="md-dialog-content">\
                  <h2 class="md-title">Confirm Online Stream</h2>\
                  <div class="md-dialog-content-body">\
                    <p>This composition contains online audio stream. You can disable it to reduce network traffic.</p>\
                  </div>\
                </md-dialog-content>\
                <md-dialog-actions>\
                  <md-button md-no-ink class="md-raised" ng-click="cancel()">Disable</md-button>\
                  <md-button md-no-ink class="md-primary md-raised" ng-click="confirm()">Allow</md-button>\
                </md-dialog-actions>',
              controller: ['$scope', '$mdDialog', function($scope, $mdDialog) {
                $scope.confirm = function() {
                  pm.addUrlStreamTrack(stream.url, config);
                  pm.project.audioTrack.initialized = false;
                  pm.project.audioTrack.play().then(function() {
                    pm.project.audioTrack.stop();
                    pm.project.audioTrack.initialized = true;
                  });
                  task.resolve(pm.project.audioTrack);
                  $mdDialog.hide();
                };
                $scope.cancel = function() {
                  $mdDialog.hide();
                  task.reject();
                };
              }]
            };
            $mdDialog.show(confirm);
          } else {
            this.addUrlStreamTrack(stream.url, config);
            task.resolve(this.project.audioTrack);
          }
        }.bind(this))
        .catch(function() {
          task.reject();
          $mdToast.show(
            $mdToast.simple()
              .toastClass('error')
              .textContent('Failed to initialize online stream track!')
              .position('top center')
          );
        })
      return task.promise;
    };

    ProjectManager.prototype.addUrlStreamTrack = function(url, config) {
      var stream;

      if (/\.(mp4|webm)$/i.test(url)) {
        var video = document.createElement('video');
        video.className = 'video-player';
        // video.setAttribute('src', url);
        video.src = url;
        // document.body.appendChild(video);
        stream = video;
      } else {
        stream = new Audio(url)
      }
      stream.autoplay = false;
      // stream.preload = 'none';

      var audio;
      if (url.startsWith('data:') || config.type === 'raw') {
        stream.crossOrigin = 'anonymous';

        var source = context.createMediaElementSource(stream);
        audio = AudioTrack(context);
        audio.source = source;
        source.connect(audio);

        // var panNode = context.createStereoPanner();
        // panNode.pan.value = -1;
        // audio.add(panNode);
      } else {
        stream.preload = 'none';
        audio = StreamAudioTrack(stream);
      }

      this.project.audioTrack = {
        _stream: stream,
        initialized: true,
        playbackRate: 1,
        playing: false,
        audio: audio,
        hasVideo: stream.tagName === 'VIDEO',
        type: 'stream',
        offset: 0,
        play: function(time) {
          if (!this.playing) {
            this.playing = true;
            this._stream.currentTime = (time || 0) + this.offset;
            return this._stream.play();
          }
          return $q.when();
        },
        stop: function() {
          this.playing = false;
          this._stream.pause();
        },
        get currentTime() {
          return this._stream.currentTime + this.offset;
        },
        set currentTime(value) {
          return this._stream.currentTime = value + this.offset;
        },
        setPlaybackRate: function(rate, delay) {
          if (delay) {
            setTimeout(function() {
              this.playbackRate = rate;
              this._stream.playbackRate = rate;
            }.bind(this), delay*1000)
          } else {
            this.playbackRate = rate;
            this._stream.playbackRate = rate;
          }
        }
      }
      this.project.audioTrack.source = config;
    }

    ProjectManager.prototype.removeAudioTrack = function() {
      this.project.audioTrack = undefined;
      this.store.project.audioTrack = undefined;
    }


    ProjectManager.prototype.createProject = function(tracks) {
      idCouter = {};
      this.store.project = null;
      this.project = {
        sections: [],
        tracks: [],
        tracksMap: {},
        playlists: []
      };
      this.createPlaylist();
      tracks.forEach(this.addTrack.bind(this));
      this.dispatchEvent('projectLoaded', this.project);
      return this.project;
    };

    ProjectManager.prototype.loadProject = function(projectId) {
      idCouter = {};
      var projectData = this.store.getProject(projectId);
      this.project = {
        name: projectData.name,
        sections: angular.copy(projectData.sections),
        tracks: [],
        tracksMap: {},
        playlists: [],
        script: projectData.script
      };
      projectData.tracks.forEach(this.addTrack.bind(this));
      if (projectData.audioTrack && projectData.audioTrack.source) {
        var config = projectData.audioTrack;
        this.addOnlineStreamTrack(config.source.resource, config.source).then(function(audioTrack) {
          audioTrack.audio.volume =  config.volume.value;
          audioTrack.audio.muted = Boolean(config.volume.muted);
        });
      }

      if (projectData.playlists.length) {
        this.project.playlists = projectData.playlists;
        this.project.playlists.forEach(function(playlist, index) {
          playlist.id = index + 1;
        });
      } else {
        this.createPlaylist();
      }
      this.dispatchEvent('projectLoaded', this.project);
      return this.project;
    };


    ProjectManager.prototype.createSection = function(baseSection) {
      var section = {
        timeSignature: {
          top: 4,
          bottom: 4
        },
        bpm: 80,
        length: 4
      };
      if (baseSection) {
        Object.keys(baseSection).forEach(function(property) {
          section[property] = baseSection[property];
        });
      }
      section.id = generateItemId(this.project.sections);
      section.tracks = {};
      this.project.sections.push(section);
      this.section = section;
      return section;
    };

    ProjectManager.prototype.createPlaylist = function() {
      var playlist = {
        id: generateItemId(this.project.playlists),
        name: '',
        items: []
      };
      this.project.playlists.push(playlist);
      return playlist;
    };

    ProjectManager.prototype.importSection = function(section) {
      console.log('importSection');
      section.id = generateItemId(this.project.sections);
      wrapSection(section);
      this.project.sections.push(section);
    };


    ProjectManager.prototype.deleteSection = function() {
      if (this.section) {
        var sectionId = this.section.id;
        if (this.store.project) {
          this.store.deleteSection(sectionId);
        }
        var index = this.project.sections.findIndex(byId(sectionId));
        this.project.sections.splice(index, 1);
      }
      this.saveProjectConfig();
      this.dispatchEvent('sectionDeleted');
    };


    ProjectManager.prototype.serializeSection = function(section) {

      var data = {
        name: section.name,
        timeSignature: section.timeSignature,
        length: section.length,
        bpm: section.bpm,
        meta: section.meta,
        barSubdivision: section.barSubdivision,
        audioTrack: section.audioTrack,
        tracks: {}
      }
      this.project.tracks.forEach(function(track) {
        var trackSection = section.tracks[track.id];
        if (trackSection) {
          // filter beats with some data only (sounds or metadata)
          var trackData = trackSection.rawData().filter(function(beatData) {
            return beatData.data.length > 0 || beatData.subdivision !== 4 ||
              (beatData.meta && Object.keys(beatData.meta).length > 0);
          });
          data.tracks[track.id] = trackData;
          // data.tracks[track.id] = trackSection.rawData();
        }
      }, this);
      return angular.toJson(data);
    }


    ProjectManager.prototype.saveProjectConfig = function() {
      // Don't save when no sections exists
      if (!this.store.project) {
        return;
      }
      function trackVolume(track) {
        return {
          muted: track.audio.muted,
          value: track.audio.volume
        };
      }

      var trackExcludedProperties = ['id', 'instrument', 'audio'];
      var tracks = this.project.tracks.map(function(track) {
        var trackConfig = Object.keys(track).reduce(function(obj, property) {
          if (trackExcludedProperties.indexOf(property) === -1) {
            obj[property] = track[property];
          }
          obj.volume = trackVolume(track);
          return obj;
        }, {});
        // Currently not needed
        // if (track.instrument.getConfig) {
        //   Object.assign(trackConfig, track.instrument.getConfig())
        // }
        return trackConfig;
      });

      if (this.project.audioTrack) {
        if (this.project.audioTrack.source) {
          this.store.project.audioTrack = {
            source: this.project.audioTrack.source,
            volume: trackVolume(this.project.audioTrack),
          };
        } else {
          delete this.store.project.audioTrack;
        }
      }

      var sectionsIndex = this.project.sections.map(function(section) {
        return {
          id: section.id,
          name: section.name
        };
      });
      this.store.saveProjectConfig(tracks, sectionsIndex);
    };

    ProjectManager.prototype.saveSection = function() {
      console.log('ProjectManager.saveSection');
      if (!this.store.project) {
        this.store.createProject(this.project.name);
      }

      var sectionId = this.section.id;
      var data = this.serializeSection(this.section);
      this.store.saveSection(sectionId, this.section.name, data);

      var sectionRecord = this.project.sections.find(byId(sectionId));
      if (sectionRecord) {
        sectionRecord.name = this.section.name;
      }

      this.saveProjectConfig();
    };

    ProjectManager.prototype.saveAsNewSection = function(newName) {
      var tracks = this.section.tracks;
      delete this.section.tracks;
      var newSection = this.createSection(this.section);
      newSection.name = newName || "New";
      newSection.tracks = tracks;
      this.section = newSection;
      this.saveSection();
    };

    ProjectManager.prototype.loadSectionData = function(section) {
      // console.log('loadSectionData');

      for (var trackId in section.tracks) {
        var trackData = section.tracks[trackId];
        if (!trackData.audio) {
          var type = trackId.split('_')[0];
          var trackClass;
          if (type === 'drums') {
            trackClass = DrumTrackSection;
          } else {
            trackClass = TrackSection;
          }
          var track = new trackClass(section, trackData);
          track.type = type;
          track.audio = this.project.tracksMap[trackId].audio;
          track.instrument = this.project.tracksMap[trackId].instrument;
          section.tracks[trackId] = track;
        }
      }
      return section;
    }

    ProjectManager.prototype._filterProjectTracks = function(section) {
      Object.keys(section.tracks).forEach(function(trackId) {
        if (!this.project.tracksMap[trackId]) {
          console.log('!! obsolete section track: '+trackId)
          delete section.tracks[trackId];
        }
      }, this);
    };

    function wrapSection(section) {
      section.beatLabels = function() {
        var labels = new Array(13);
        if (this.barSubdivision) {
          var parts = this.barSubdivision.split('+').map(Number);
          var index = 1;
          for (var i = 0; i < parts.length; i++) {
            var iBeat = 1;
            var count = parts[i];
            while (count--) {
              labels[index++] = iBeat++;
            }
          }
        } else {
          for (var i = 1; i <= this.timeSignature.top; i++) {
            labels[i] = i;
          }
        }
        return labels;
      }.bind(section);
    }

    ProjectManager.prototype.getSection = function(sectionId) {
      var section = this.project.sections.find(byId(sectionId));
      if (!section) {
        console.log('invalid section id: '+sectionId);
        return;
      }

      // TODO: better section state marking/checking (loaded, converted, ...)
      if (section.tracks && section.tracks[this.project.tracks[0].id]) {
        if (angular.isFunction(section.tracks[this.project.tracks[0].id].beat)) {
          console.log('Already converted/loaded section');
          // already converted to Track
          this._filterProjectTracks(section);
          return section;
        }
      }

      // empty section
      if (!section.tracks) {
        section.tracks = {};
      }

      // console.log('--- load section from store ---');
      var storedSection = this.store.getSection(section.id);
      if (storedSection) {
        this._filterProjectTracks(storedSection);
        section = this.loadSectionData(storedSection);

        // backward compatibility
        if (typeof section.audioTrackStart === 'string') {
          section.audioTrackStart = section.audioTrackStart.split(":").map(Number);
        }
        if (section.audioTrackStart) {
          section.audioTrack = {
            start: section.audioTrackStart
          };
          delete section.audioTrackStart;
        }

      }
      wrapSection(section);
      return section;
    }


    ProjectManager.prototype.loadSection = function(sectionId) {
      console.log('loadSection: '+sectionId);
      this.section = this.getSection(sectionId);
      this.dispatchEvent('sectionLoaded', this.section);
    };

    ProjectManager.prototype.loadPlaylist = function(playlist) {
      if (Number.isInteger(playlist)) {
        playlist = this.project.playlists.find(byId(playlist));
      }
      this.playlist = playlist;
      this.dispatchEvent('playlistLoaded', this.playlist);
    };

    ProjectManager.prototype.deletePlaylist = function(playlistId) {
      var index = this.project.playlists.findIndex(byId(playlistId));
      if (index !== -1) {
        this.project.playlists.splice(index, 1);
      }
    };

    ProjectManager.prototype._playlistsData = function() {
      return this.project.playlists.map(function(playlist) {
        return {
          name: playlist.name,
          items: playlist.items,
          backingTrack: playlist.backingTrack
        };
      });
    }
    ProjectManager.prototype.savePlaylists = function() {
      this.store.savePlaylists(this._playlistsData());
    };

    return new ProjectManager();
  }

})();