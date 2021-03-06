(function() {
  'use strict';

  angular
    .module('bd.help')
    .controller('SoundPropertiesSlideshow', SoundPropertiesSlideshow)



  function SoundPropertiesSlideshow($scope, $element, $timeout, bassEditor, bassSoundForm, $mdCompiler) {

    var editSound, editElem, form;

    $scope.instructions = [
      /* Create a first sound */
      function() {
        editSound = {
          start: 0.5,
          string: 'G',
          volume: 0.75,
          style: 'finger',
          note: {
            type: 'regular',
            name: 'A',
            octave: 2,
            code: 'A2',
            fret: 2,
            length: 16,
          }
        };
        $scope.workspace.trackSection.addSound($scope.workspace.trackSection.beat(1, 1), editSound);
      },
      function() {
        editElem = $element[0].querySelector('.sound-container');
        form = bassSoundForm.open(
          {target: editElem},
          editSound,
          {
            clickOutsideToClose: false,
            escapeToClose: false,
            // attachTo: angular.element(document.querySelector('.help-container .content')),
            attachTo: $element.parent(),
            panelClass: 'non-interactive bass-form'
          }
        );
      },
      function() {
        // formScope = angular.element(document.querySelector('.bass-sound-form')).scope();
        editSound.note.dotted = true;
        // formScope.soundLengthChanged(editSound);
        editSound.end = editSound.start + $scope.workspace.trackSection.soundDuration(editSound);
      },
      function() {
        editSound.note.staccato = true;
      },

      /* Clear bass sheet */
      function() {
        if (form) {
          form.close();
          form = null;
        }
        bassEditor.selector.clearSelection();
        $scope.workspace.trackSection.clearBeat($scope.workspace.trackSection.beat(1, 1));
      }
    ];
  }

})();