# Land of Eem Character Sheet for Owlbear Rodeo

Ready-to-host static extension. It works as a companion to the existing Land of Eem Character Builder: save a character as `.eem.json`, then import that file inside Owlbear Rodeo and attach it to a Character-layer token.

## Features

- Imports builder `.eem.json` files.
- Stores the imported source and playable sheet on an Owlbear token.
- In-session editing for Courage, Dread, Attack, Defense, Quest Points, all 16 skills, inventory, abilities/perks, and notes.
- Uses the namespaced metadata key `com.pipeworks.land-of-eem/character`.
- Scene item metadata synchronizes with the Owlbear room.
- Can export an `.eem.json` containing the original save plus `owlbear.sheet` play-state data.

## Install

Upload every file in this folder to the same HTTPS static host. Then add the public `manifest.json` URL in Owlbear Rodeo's extension settings.

For local testing you can serve this folder from any local static web server and use its `manifest.json` URL. Owlbear's official tutorials also support localhost extension development.

## Compatibility

The importer is schema-tolerant because the currently published ChatGPT Site exposes the builder as a Site artifact, not as an editable source bundle through this project's file API. The importer recursively recognizes common Land of Eem field names. A real `.eem.json` sample from the builder can be used to make field mapping exact if any fields do not import correctly.

The Owlbear SDK is loaded as an ES module from jsDelivr, pinned to version 3.1.0.
