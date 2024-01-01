import { parseRequestBody, sendOverpassApiRequest } from '../../utils/overpass'
import { NodeElement, OverpassResponse, RoadElement } from './types'

export async function getRoadsOfNode(node: NodeElement) {
    const rawQuery = {
        data: `[out:json][timeout:25];
        node(${node.id});
     
	way(bn)[highway~"^(motorway|trunk|primary|unclassified|living_street|service|secondary|residential|tertiary|(motorway|trunk|primary|tertiary|secondary)_link)$"]->.allways;
       	node(w.allways)->.allnodes;
		foreach .allnodes -> .currentnode(
            way(bn.currentnode)[highway~"^(motorway|trunk|unclassified|primary|living_street|service|secondary|residential|tertiary|(motorway|trunk|primary|tertiary|secondary)_link)$"]->.allroads;
          node(way_link.allroads:3-)->.currentnode;
          (.currentnode; .intersections;)->.intersections;
        
       );
		 (.allways; .intersections;)->.union; 
        .union out geom;
`,
    }
    const requestBody = parseRequestBody(rawQuery)
    const result = (await sendOverpassApiRequest(
        requestBody
    )) as OverpassResponse<RoadElement & NodeElement>
    return result
}
