(function() {
  'use strict';

  angular
    .module('bd.app')
    .directive('bdFretDiagram', fretDiagram)
    .factory('fretboardViewer', fretboardViewer);


  function fretDiagram(workspace) {
    return {
      scope: {
        config: '=bdFretDiagram',
      },
      controller: function($scope) {
        var config = $scope.config;
        var instrument = workspace.track.instrument;
        console.log(config)

        function labelToNote(noteCode) {
          var data = noteCode.split(":");
          var string = data[0];
          var noteName = data[1];
          var note = instrument.notes.map[noteName];
          var fret = instrument.strings[string].notes.indexOf(note);
          return {
            id: noteCode,
            string: string,
            label: noteName,
            fret: instrument.strings[string].notes.indexOf(note),
            index: instrument.notes.list.indexOf(note)
          }
        }
        $scope.instrument = instrument;
        $scope.rootNote = labelToNote(config.root);
        $scope.notes = config.notes.map(labelToNote);
        $scope.noteById = {};
        $scope.notes.forEach(function(note) {
          note.interval = note.index - $scope.rootNote.index;
          $scope.noteById[note.id] = note;
        });
        console.log($scope.noteById)

        var frets = [$scope.rootNote].concat($scope.notes)
          .map(function(note) {
            return note.fret;
          });
        var minFret = Math.min.apply(null, frets);
        var maxFret = Math.max.apply(null, frets);

        minFret = 0; maxFret = 19;
        $scope.frets = [];
        for (var i = minFret; i <= maxFret; i++) {
          $scope.frets.push(i);
        }
      },
      templateUrl: 'views/fret_diagram.html'
    };
  }

  function fretboardViewer(context, workspace, audioPlayer) {

    var diagramElem;
    var lastPlayedFret = 5;
    var stringsMap = {};
    var ghostMap = {}

    function FretboardViewer() {
      
      audioPlayer._bassSoundScheduled = function(trackId, audio) {
        var sound = audio.meta;

        // console.log('_bassSoundScheduled')
        // console.log(diagramElem)
        if (diagramElem && trackId === workspace.track.id) {
          var currentTime = context.currentTime;
          function delayTime(time) {
            return parseInt((time - currentTime) * 1000);
          }
          if (sound.type === 'single') {
            // console.log('HIGHLIGHT NOTE');
            var id = '#'+sound.string+'_'+sound.note.name+sound.note.octave;
            var elem = diagramElem.querySelector(id);

            setTimeout(function(elem) {
              if (stringsMap[sound.string] && stringsMap[sound.string].elem === elem) {
                if (stringsMap[sound.string].end) {
                  var elapsed = context.currentTime - stringsMap[sound.string].end
                  // console.log('same note: '+elapsed)
                  if (elapsed < 0.012) {
                    elem.style.opacity = 0.75
                    setTimeout(function() {
                      elem.style.opacity = 1
                    }, 20)
                  }
                }
              }
              // console.log('starting playback: '+sound.startTime)
              stringsMap[sound.string] = {
                start: sound.startTime,
                elem: elem
              };
              elem.classList.add('highlight');
              lastPlayedFret = sound.note.fret;
            }, delayTime(sound.startTime), elem);

            audio.source.onended = function() {
              if (sound.startTime === stringsMap[sound.string].start) {
                stringsMap[sound.string].end = context.currentTime
              }
              if (sound.startTime === stringsMap[sound.string].start || elem !== stringsMap[sound.string].elem) {
                elem.classList.remove('highlight');
              } else {
                // same note as previous, but a new one is already highlighted
                // console.log('blink')
                elem.style.opacity = 0.75
                setTimeout(function() {
                  elem.style.opacity = 1
                }, 30)
              }
            }
          } else if (sound.type === 'sequence') {
            console.log('HIGHLIGHT sequence');
            // console.log(sound)
            var prevElems = [];
            sound.notes.forEach(function(subsound, index) {
              var query;
              if (subsound.note.name) {
                query = '#'+sound.string+'_'+subsound.note.name+subsound.note.octave;
              } else {
                query = '.string.{0} .fret-{1} label'.format(sound.string, subsound.note.fret);
              }
              var elems = Array.from(diagramElem.querySelectorAll(query));
              setTimeout(function(elems, prevElems) {
                prevElems.forEach(function(elem) {
                  elem.classList.remove('highlight');
                });
                // for (var elem of elems) {
                //   elem.classList.remove('active');
                // }
                elems.forEach(function(elem) {
                  elem.classList.add('highlight');
                });
              }, delayTime(subsound.startTime), elems, prevElems);
              prevElems = elems;
            });
            var lastNote = sound.notes[sound.notes.length-1];
            setTimeout(function() {
              prevElems.forEach(function(elem) {
                elem.classList.remove('highlight');
              });
            }, delayTime(lastNote.startTime+lastNote.duration)-5);
          } else if (sound.type === 'ghost') {
            var ghostFret = angular.isDefined(audio.sound.note.fret)? audio.sound.note.fret : lastPlayedFret;

            /*
            var query = '.string.{0} .fret-{1}'.format(sound.string, ghostFret+1)
            var elem = diagramElem.querySelector(query);
            elem.classList.add('x')

            audio.source.onended = function() {
              console.log('ghost ended')
              elem.classList.remove('x');
            }
            */
            var query = [ghostFret, ghostFret+1, ghostFret+2].map(function(fret) {
              return '.string.{0} .fret-{1} label'.format(sound.string, fret)
            }).join(',')
            var elems = Array.from(diagramElem.querySelectorAll(query));

            setTimeout(function() {
              console.log('GHOST START: '+sound.startTime)
              elems.forEach(function(elem) {
                elem.classList.add('highlight');
                elem.classList.add('x');
              });
              ghostMap[sound.string] = {
                start: sound.startTime,
                fret: ghostFret
              };
            }, delayTime(sound.startTime));

            audio.source.onended = function() {
              console.log('GHOST END: '+ghostMap[sound.string].start)
              // elems.forEach(function(elem) {
              //   elem.classList.remove('highlight');
              //   elem.classList.remove('x');
              // });
              console.log(ghostFret +' vs ' + ghostMap[sound.string].fret)
              if (sound.startTime === ghostMap[sound.string].start || ghostFret !== ghostMap[sound.string].fret) {
                elems.forEach(function(elem) {
                  elem.classList.remove('highlight');
                  elem.classList.remove('x');
                })
              } else {
                // same note as previous, but a new one is already highlighted
                console.log('ghost blink')
                elems.forEach(function(elem) {
                  elem.style.opacity = 0.75;
                })
                setTimeout(function() {
                  elems.forEach(function(elem) {
                    elem.style.opacity = 1;
                  })
                }, 30)
              }
            }

            // setTimeout(function() {
            //   elems.forEach(function(elem) {
            //     elem.classList.remove('highlight');
            //   });
            // }, delayTime(sound.startTime+sound.duration));

            /*
            var ghostElem = diagramElem.querySelector('.string.{0} .ghost-note label'.format(sound.string));
            setTimeout(function() {
              ghostElem.classList.add('highlight');
            }, delayTime(sound.startTime));
            setTimeout(function() {
              ghostElem.classList.remove('highlight');
            }, delayTime(sound.startTime+sound.duration));
            */
          }
        }
      }
    }

    FretboardViewer.prototype.activate = function(containerElem) {
      diagramElem = containerElem;
    };

    FretboardViewer.prototype.clearActiveChord = function() {
      if (!diagramElem) return;
      var elems = Array.from(diagramElem.querySelectorAll('.active'));
      elems.forEach(function(elem) {
        elem.classList.remove('active');
      });
      var rootElem = diagramElem.querySelector('.root');
      if (rootElem) {
        rootElem.classList.remove('root');
      }
    }

    FretboardViewer.prototype.clearDiagram = function() {
      console.log('clearDiagram')
      if (!diagramElem) return;
      this.clearActiveChord();
      var elems = Array.from(diagramElem.querySelectorAll('.highlight'));
      elems.forEach(function(elem) {
        elem.classList.remove('highlight');
      });
    }

    FretboardViewer.prototype.setChord = function(section, trackId, chord) {
      this.clearActiveChord();
      if (!diagramElem || !chord.root) {
        return;
      }

      var qs = '#{0}_{1}{2}'.format(chord.string, chord.root, chord.octave);
      var rootElem = diagramElem.querySelector(qs);
      if (rootElem) {
        rootElem.classList.add('root');
      }

      var sBar = chord.start[0];
      var sBeat = chord.start[1];
      var sSubbeat = chord.start[2] || 1;

      var trackSection = section.tracks[trackId];
      var nextChordIndex = section.meta.chords.indexOf(chord);
      var nextChord = section.meta.chords[nextChordIndex+1];

      var end = nextChord? nextChord.start : [section.length+1, 1, 1];
      var eBar = end[0];
      var eBeat = end[1];
      var eSubbeat = end[2];

      var startRange = sBar*1000 + sBeat*10 + sSubbeat;
      var endRange = eBar*1000 + eBeat*10 + eSubbeat;

      // collect sounds in chord range
      var sounds = [];
      var beat = trackSection.beat(sBar, sBeat);
      while (beat && (beat.bar*1000 + beat.beat*10) < endRange) {
        Array.prototype.push.apply(
          sounds,
          trackSection.beatSounds(beat)
            .filter(function(sound) {
              var soundPosition = beat.bar*1000 + beat.beat*10 + (sound.start*beat.subdivision)+1;
              return soundPosition >= startRange && soundPosition < endRange;
            })
        );
        beat = trackSection.nextBeat(beat);
      }

      var ids = new Set();
      sounds.forEach(function(sound) {
        if (sound.note.type !== 'ghost') {
          var id = '#'+sound.string+'_'+sound.note.name+sound.note.octave;
          ids.add(id);
        }
        if (sound.note.type === 'slide') {
          var id = '#'+sound.string+'_'+sound.note.slide.endNote.name+sound.note.slide.endNote.octave;
          ids.add(id);
        }
      });
      var query = Array.from(ids).join(',');
      if (query) {
        Array.from(diagramElem.querySelectorAll(query)).forEach(function(elem) {
          elem.classList.add('active');
        });
      }
    };

    FretboardViewer.prototype.beatSync = function(evt) {
      if (!evt.section.meta || !evt.section.meta.chords) {
        return;
      }
      var newChord = evt.section.meta.chords.find(function(chord, index) {
        return chord.start[0] === evt.bar && chord.start[1] === evt.beat;
      });

      if (newChord) {
        var subbeat = newChord.start[2] || 1;
        // TODO: get beat subdivision properly
        var time = (evt.startTime - evt.eventTime) + (subbeat-1)*evt.duration/4;
        setTimeout(function() {
          this.setChord(evt.section, workspace.track.id, newChord);
        }.bind(this), parseInt(time*1000)-10);
      }
    };

    /*
    workspace.diagram = function(root, start, end) {
      var containerElem = angular.element(document.querySelector('.diagram-container'));
      containerElem.children().remove();

      var sBar = start[0];
      var sBeat = start[1];
      var sSubbeat = start[2] || 1;
      var eBar = end[0];
      var eBeat = end[1];
      var eSubbeat = end[2] || 4;

      var beat = workspace.trackSection.beat(sBar, sBeat);
      var sounds;
      if (sBar === eBar && sBeat === eBeat) {
        sounds = workspace.trackSection.beatSounds(beat)
          .filter(function(sound) {
            return sound.subbeat >= sSubbeat && sound.subbeat <= eSubbeat;
          });
      } else {
        sounds = workspace.trackSection.beatSounds(beat)
          .filter(function(sound) {
            return sound.subbeat >= sSubbeat;
          });

        while (true) {
          beat = workspace.trackSection.nextBeat(beat);
          if (beat.bar === eBar && beat.beat == eBeat) {
            break;
          }
          Array.prototype.push.apply(sounds, workspace.trackSection.beatSounds(beat));
        }
        Array.prototype.push.apply(
          sounds,
          workspace.trackSection.beatSounds(beat)
            .filter(function(sound) {
              return sound.subbeat <= eSubbeat;
            })
        );
      }
      // console.log(sounds);
      var notes = new Set();
      sounds.forEach(function(beatSound) {
        var sound = beatSound.sound;
        if (sound.note.type !== 'ghost') {
          var note = sound.string+':'+sound.note.name+sound.note.octave;
          notes.add(note);
        }
      });
      var data = {
        track: workspace.track.id,
        root: root,
        notes: Array.from(notes)
      }
      var dataStr = JSON.stringify(data).replace(/"/g, "'");
      var html = '<div bd-fret-diagram="{0}"></div>'.format(dataStr);
      var ngElem = angular.element(html);
      $compile(ngElem)($scope);
      containerElem.append(ngElem);
    }
    */

    return new FretboardViewer();
  }
})();