/**
 * Overrides de autolinking de React Native.
 *
 * react-native-share-menu: su `namespace` de Android es `com.meedan.shareMenu`,
 * pero su clase `ReactPackage` vive en el paquete Java `com.meedan`
 * (com.meedan.ShareMenuPackage). El autolinking moderno (RN 0.81) deriva el
 * import del namespace y genera `com.meedan.shareMenu.ShareMenuPackage` —una
 * clase que no existe—, provocando "cannot find symbol" en PackageList.java al
 * compilar. Aquí forzamos el import y la instancia correctos.
 */
module.exports = {
  dependencies: {
    "react-native-share-menu": {
      platforms: {
        android: {
          packageImportPath: "import com.meedan.ShareMenuPackage;",
          packageInstance: "new ShareMenuPackage()",
        },
      },
    },
  },
};
