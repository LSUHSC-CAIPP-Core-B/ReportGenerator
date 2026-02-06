import { Liquid } from "liquidjs";
import { TEMPLATE_DIRECTORY } from "../constants";

import titleCasePlugin from './plugins/titlecase';

const liquid = new Liquid({
  root: [
    TEMPLATE_DIRECTORY,
    `${TEMPLATE_DIRECTORY}/builtin/`,
    `${TEMPLATE_DIRECTORY}/builtin/partial/`,
    `${TEMPLATE_DIRECTORY}/builtin/meta/`,
  ],
  extname: '.html',
});

liquid.plugin(titleCasePlugin);

export default liquid;
